import type { Transform } from "jscodeshift";
import { ImportManager } from "../utils/import-manager.js";
import { ProtobufIdentifierTracker } from "../utils/protobuf-identifier-tracker.js";
import { isSchemaName, toSchemaName } from "../utils/schema-name.js";

/**
 * protobuf メッセージ型が値として参照されている箇所を Schema に変換する。
 *
 * protobuf-es v2 ではメッセージ型がクラスではなくなったため、
 * 値として渡していた箇所は対応する Schema ディスクリプタに変える必要がある。
 *
 * 例: `findDetails(ErrorInfo)` → `findDetails(ErrorInfoSchema)`
 *
 * 対象:
 * - 関数呼び出しの引数として渡されている protobuf 識別子
 *   (ただし、既に Schema 名であるものは除外)
 */
const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const tracker = ProtobufIdentifierTracker.fromRoot(root, j);

  const schemasToAdd = new Map<string, string>();

  // 関数呼び出しの引数に含まれる protobuf identifier を Schema に変換
  root.find(j.CallExpression).forEach((path) => {
    for (const arg of path.node.arguments) {
      if (arg.type !== "Identifier") continue;
      if (!tracker.isProtobufIdentifier(arg.name)) continue;

      const originalName = tracker.getOriginalName(arg.name) ?? arg.name;
      if (isSchemaName(originalName)) continue;
      // サービスディスクリプタは v2 でもそのまま値として使うため除外
      if (isServiceName(originalName)) continue;
      const sourceFile = tracker.getSourceFile(arg.name);
      if (!sourceFile) continue;

      const schemaName = toSchemaName(originalName);

      // 引数を Schema 名に置き換え
      arg.name = schemaName;
      schemasToAdd.set(schemaName, sourceFile);
    }
  });

  if (schemasToAdd.size === 0) {
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

function isServiceName(name: string): boolean {
  return name.endsWith("Service");
}

export default transform;
export const parser = "tsx";
