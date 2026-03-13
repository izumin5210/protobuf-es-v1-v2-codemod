import type { Transform } from "jscodeshift";
import { ImportManager } from "../utils/import-manager.js";
import { ProtobufIdentifierTracker } from "../utils/protobuf-identifier-tracker.js";
import { toSchemaName } from "../utils/schema-name.js";

const PROTOBUF_RUNTIME_PACKAGE = "@bufbuild/protobuf";

/**
 * `x instanceof MessageType` を `isMessage(x, MessageTypeSchema)` に変換する。
 *
 * protobuf-es v2 ではメッセージがクラスではなくなったため、
 * instanceof による型チェックは isMessage() 関数に置き換える必要がある。
 */
const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const tracker = ProtobufIdentifierTracker.fromRoot(root, j);

  const schemasToAdd = new Map<string, string>();
  let needsIsMessage = false;

  // `x instanceof ProtoMessage` → `isMessage(x, ProtoMessageSchema)`
  root.find(j.BinaryExpression, { operator: "instanceof" }).forEach((path) => {
    const right = path.node.right;
    if (right.type !== "Identifier") return;
    if (!tracker.isProtobufIdentifier(right.name)) return;

    const originalName = tracker.getOriginalName(right.name) ?? right.name;
    const sourceFile = tracker.getSourceFile(right.name);
    if (!sourceFile) return;

    const schemaName = toSchemaName(originalName);

    // `x instanceof Foo` → `isMessage(x, FooSchema)`
    j(path).replaceWith(
      j.callExpression(j.identifier("isMessage"), [
        path.node.left,
        j.identifier(schemaName),
      ]),
    );

    schemasToAdd.set(schemaName, sourceFile);
    needsIsMessage = true;
  });

  if (!needsIsMessage) {
    return fileInfo.source;
  }

  // Schema import の追加
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

  // isMessage を @bufbuild/protobuf から追加
  importManager.addNamedImport(PROTOBUF_RUNTIME_PACKAGE, "isMessage");

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
