import type { Transform } from "jscodeshift";
import { ProtobufIdentifierTracker } from "../utils/protobuf-identifier-tracker.js";
import { ImportManager } from "../utils/import-manager.js";
import { toSchemaName } from "../utils/schema-name.js";

const PROTOBUF_RUNTIME_PACKAGE = "@bufbuild/protobuf";

/**
 * proto3.getEnumType(EnumName).findNumber(expr) を
 * EnumNameSchema.values.find(v => v.number === expr) に変換する。
 *
 * v1: proto3.getEnumType(Permission).findNumber(p)
 * v2: PermissionSchema.values.find(v => v.number === p)
 */
const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const tracker = ProtobufIdentifierTracker.fromRoot(root, j);
  const importManager = new ImportManager(root, j);

  const schemasToAdd = new Map<string, string>();
  let hasTransformations = false;

  // proto3.getEnumType(X).findNumber(expr) パターンを検索
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        property: { type: "Identifier", name: "findNumber" },
      },
    })
    .forEach((path) => {
      const callee = path.node.callee;
      if (callee.type !== "MemberExpression") return;

      // callee.object が proto3.getEnumType(X) の呼び出しであることを確認
      const getEnumTypeCall = callee.object;
      if (getEnumTypeCall.type !== "CallExpression") return;
      if (getEnumTypeCall.callee.type !== "MemberExpression") return;

      const proto3Obj = getEnumTypeCall.callee.object;
      const getEnumTypeProp = getEnumTypeCall.callee.property;

      if (proto3Obj.type !== "Identifier" || proto3Obj.name !== "proto3") return;
      if (getEnumTypeProp.type !== "Identifier" || getEnumTypeProp.name !== "getEnumType") return;

      // getEnumType の引数からenum名を取得
      if (getEnumTypeCall.arguments.length !== 1) return;
      const enumArg = getEnumTypeCall.arguments[0];
      if (enumArg.type !== "Identifier") return;

      const enumName = enumArg.name;
      if (!tracker.isProtobufIdentifier(enumName)) return;

      const sourceFile = tracker.getSourceFile(enumName);
      if (!sourceFile) return;

      const originalName = tracker.getOriginalName(enumName) ?? enumName;
      const schemaName = toSchemaName(originalName);

      // findNumber の引数を取得
      if (path.node.arguments.length !== 1) return;
      const findNumberArg = path.node.arguments[0];
      if (findNumberArg.type === "SpreadElement") return;

      // EnumNameSchema.values.find(v => v.number === expr) を構築
      const replacement = j.callExpression(
        j.memberExpression(
          j.memberExpression(
            j.identifier(schemaName),
            j.identifier("values"),
          ),
          j.identifier("find"),
        ),
        [
          j.arrowFunctionExpression(
            [j.identifier("v")],
            j.binaryExpression(
              "===",
              j.memberExpression(
                j.identifier("v"),
                j.identifier("number"),
              ),
              findNumberArg,
            ),
          ),
        ],
      );

      j(path).replaceWith(replacement);

      schemasToAdd.set(schemaName, sourceFile);
      hasTransformations = true;
    });

  if (!hasTransformations) {
    return fileInfo.source;
  }

  // proto3 import の削除
  // proto3 が他で使われていなければ削除する
  const proto3Usages = root.find(j.Identifier, { name: "proto3" }).filter((path) => {
    // import specifier 内の使用は除外
    return path.parent.node.type !== "ImportSpecifier" &&
      path.parent.node.type !== "ImportDefaultSpecifier";
  });

  if (proto3Usages.length === 0) {
    importManager.removeNamedImport(PROTOBUF_RUNTIME_PACKAGE, "proto3");
  }

  // Schema import の追加
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

  return root.toSource();
};

export default transform;
export const parser = "tsx";
