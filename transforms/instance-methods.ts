import type { Transform, ASTPath, Identifier } from "jscodeshift";
import { ProtobufIdentifierTracker } from "../utils/protobuf-identifier-tracker.js";
import { ImportManager } from "../utils/import-manager.js";
import { toSchemaName, isSchemaName } from "../utils/schema-name.js";

const PROTOBUF_RUNTIME_PACKAGE = "@bufbuild/protobuf";

const INSTANCE_METHODS = new Set([
  "toBinary",
  "toJson",
  "toJsonString",
  "clone",
  "equals",
]);

const STATIC_METHODS = new Set(["fromBinary", "fromJson", "fromJsonString"]);

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const tracker = ProtobufIdentifierTracker.fromRoot(root, j);

  // 変数名 → protobuf メッセージ型名のマッピングを構築
  const variableTypeMap = new Map<string, string>();

  buildVariableTypeMap(variableTypeMap);

  const schemasToAdd = new Map<string, string>();
  const runtimeFunctionsToAdd = new Set<string>();

  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const callee = path.node.callee;
      if (callee.type !== "MemberExpression") return;

      const property = callee.property;
      if (property.type !== "Identifier") return;
      if (!INSTANCE_METHODS.has(property.name)) return;

      const object = callee.object;
      const methodName = property.name;

      // パターン1: 変数名からの型推論 - `msg.method(args)`
      if (object.type === "Identifier") {
        const messageName = variableTypeMap.get(object.name);
        if (!messageName) return;

        const sourceFile = tracker.getSourceFile(messageName);
        if (!sourceFile) return;

        const originalName = tracker.getOriginalName(messageName) ?? messageName;
        const schemaName = toSchemaName(originalName);

        // `msg.method(args)` → `method(Schema, msg, args)`
        const args = [
          j.identifier(schemaName),
          j.identifier(object.name),
          ...path.node.arguments,
        ];

        j(path).replaceWith(
          j.callExpression(j.identifier(methodName), args),
        );

        runtimeFunctionsToAdd.add(methodName);
        schemasToAdd.set(schemaName, sourceFile);
        return;
      }

      // パターン2: create(XSchema, ...).method() チェーン
      if (
        object.type === "CallExpression" &&
        object.callee.type === "Identifier" &&
        object.callee.name === "create" &&
        object.arguments.length >= 1 &&
        object.arguments[0].type === "Identifier" &&
        isSchemaName(object.arguments[0].name)
      ) {
        const schemaIdentifier = object.arguments[0];
        // create(XSchema, ...).method(args) → method(XSchema, create(XSchema, ...), args)
        const args = [
          schemaIdentifier,
          object,
          ...path.node.arguments,
        ];

        j(path).replaceWith(
          j.callExpression(j.identifier(methodName), args),
        );

        runtimeFunctionsToAdd.add(methodName);
        // Schema は既に import されているはずなので schemasToAdd に追加しない
        return;
      }
    });

  if (runtimeFunctionsToAdd.size === 0) {
    return fileInfo.source;
  }

  // Import management (same pattern as static-methods.ts)
  const importManager = new ImportManager(root, j);
  const typeOnlySourceSchemas = new Map<string, string[]>();

  for (const [schemaName, sourceFile] of schemasToAdd) {
    const existingDecls = root.find(j.ImportDeclaration, {
      source: { value: sourceFile },
    });

    let hasValueImport = false;
    existingDecls.forEach((declPath) => {
      if (declPath.node.importKind !== "type") {
        hasValueImport = true;
      }
    });

    if (hasValueImport) {
      importManager.addNamedImport(sourceFile, schemaName);
    } else {
      const schemas = typeOnlySourceSchemas.get(sourceFile) ?? [];
      schemas.push(schemaName);
      typeOnlySourceSchemas.set(sourceFile, schemas);
    }
  }

  importManager.apply();

  // type-only source に対して value import を直接挿入
  for (const [sourceFile, schemaNames] of typeOnlySourceSchemas) {
    const specifiers = schemaNames.map((name) =>
      j.importSpecifier(j.identifier(name)),
    );
    const newDecl = j.importDeclaration(specifiers, j.literal(sourceFile));

    const program = root.find(j.Program).paths()[0];
    const body = program.node.body;
    let insertIndex = -1;

    for (let i = body.length - 1; i >= 0; i--) {
      const node = body[i];
      if (
        node.type === "ImportDeclaration" &&
        node.source.value === sourceFile
      ) {
        insertIndex = i + 1;
        break;
      }
    }

    if (insertIndex >= 0) {
      body.splice(insertIndex, 0, newDecl);
    } else {
      let lastImportIndex = -1;
      for (let i = 0; i < body.length; i++) {
        if (body[i].type === "ImportDeclaration") {
          lastImportIndex = i;
        }
      }
      body.splice(lastImportIndex + 1, 0, newDecl);
    }
  }

  // Runtime function imports
  const existingRuntimeImport = root.find(j.ImportDeclaration, {
    source: { value: PROTOBUF_RUNTIME_PACKAGE },
  });

  if (existingRuntimeImport.length === 0) {
    const sortedFunctions = [...runtimeFunctionsToAdd].sort();
    const runtimeImportDecl = j.importDeclaration(
      sortedFunctions.map((name) => j.importSpecifier(j.identifier(name))),
      j.literal(PROTOBUF_RUNTIME_PACKAGE),
    );

    const program = root.find(j.Program).paths()[0];
    const body = program.node.body;
    const firstImportIndex = body.findIndex(
      (node) => node.type === "ImportDeclaration",
    );

    if (firstImportIndex >= 0) {
      body.splice(firstImportIndex, 0, runtimeImportDecl);
    } else {
      body.unshift(runtimeImportDecl);
    }
  } else {
    existingRuntimeImport.forEach((path) => {
      const specifiers = path.node.specifiers ?? [];
      for (const funcName of runtimeFunctionsToAdd) {
        const hasFunc = specifiers.some(
          (s) => s.type === "ImportSpecifier" && s.local?.name === funcName,
        );
        if (!hasFunc) {
          specifiers.push(j.importSpecifier(j.identifier(funcName)));
        }
      }
    });
  }

  return root.toSource();

  /**
   * 変数の型注釈、コンストラクタ、静的メソッドから変数→protobuf型のマッピングを構築する。
   *
   * 優先順:
   * 1. 型注釈: `const user: User = ...`
   * 2. コンストラクタ: `const user = new User(...)`
   * 3. 静的メソッド: `const user = User.fromBinary(...)`
   * 4. 関数パラメータ型注釈: `function foo(user: User)`
   */
  function buildVariableTypeMap(map: Map<string, string>): void {
    // 1 & 2 & 3: VariableDeclarator から推論
    root.find(j.VariableDeclarator).forEach((path) => {
      const id = path.node.id;
      if (id.type !== "Identifier") return;

      const varName = id.name;

      // 型注釈がある場合
      const typeAnnotation = (id as Identifier & { typeAnnotation?: { typeAnnotation?: { typeName?: { name?: string } } } }).typeAnnotation;
      if (typeAnnotation) {
        const tsType = typeAnnotation.typeAnnotation;
        if (
          tsType &&
          tsType.typeName &&
          typeof tsType.typeName.name === "string" &&
          tracker.isProtobufIdentifier(tsType.typeName.name)
        ) {
          map.set(varName, tsType.typeName.name);
          return;
        }
      }

      // コンストラクタから推論: `new User(...)`
      const init = path.node.init;
      if (init?.type === "NewExpression" && init.callee.type === "Identifier") {
        const calleeName = init.callee.name;
        if (tracker.isProtobufIdentifier(calleeName)) {
          map.set(varName, calleeName);
          return;
        }
      }

      // 静的メソッドから推論: `User.fromBinary(...)`
      if (
        init?.type === "CallExpression" &&
        init.callee.type === "MemberExpression" &&
        init.callee.object.type === "Identifier" &&
        init.callee.property.type === "Identifier" &&
        STATIC_METHODS.has(init.callee.property.name)
      ) {
        const objectName = init.callee.object.name;
        if (tracker.isProtobufIdentifier(objectName)) {
          map.set(varName, objectName);
          return;
        }
      }
    });

    // 4: 関数パラメータの型注釈
    const functionNodes = [
      ...root.find(j.FunctionDeclaration).paths(),
      ...root.find(j.FunctionExpression).paths(),
      ...root.find(j.ArrowFunctionExpression).paths(),
    ];

    for (const funcPath of functionNodes) {
      for (const param of funcPath.node.params) {
        if (param.type !== "Identifier") continue;
        const paramId = param as Identifier & { typeAnnotation?: { typeAnnotation?: { typeName?: { name?: string } } } };
        const typeAnnotation = paramId.typeAnnotation;
        if (!typeAnnotation) continue;
        const tsType = typeAnnotation.typeAnnotation;
        if (
          tsType &&
          tsType.typeName &&
          typeof tsType.typeName.name === "string" &&
          tracker.isProtobufIdentifier(tsType.typeName.name)
        ) {
          map.set(paramId.name, tsType.typeName.name);
        }
      }
    }

    // メソッドパラメータ
    root.find(j.ClassMethod).forEach((methodPath: ASTPath) => {
      const node = methodPath.node as { params?: Array<{ type: string; name?: string; typeAnnotation?: { typeAnnotation?: { typeName?: { name?: string } } } }> };
      for (const param of node.params ?? []) {
        if (param.type !== "Identifier" || !param.name) continue;
        const tsType = param.typeAnnotation?.typeAnnotation;
        if (
          tsType &&
          tsType.typeName &&
          typeof tsType.typeName.name === "string" &&
          tracker.isProtobufIdentifier(tsType.typeName.name)
        ) {
          map.set(param.name, tsType.typeName.name);
        }
      }
    });
  }
};

export default transform;
export const parser = "tsx";
