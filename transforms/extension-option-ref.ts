import type { Transform } from "jscodeshift";
import { ImportManager } from "../utils/import-manager.js";
import { ProtobufIdentifierTracker } from "../utils/protobuf-identifier-tracker.js";
import { isSchemaName } from "../utils/schema-name.js";

const SCHEMA_SUFFIX = "Schema";
const OPTION_FUNCTIONS = new Set(["getOption", "hasOption"]);

/**
 * proto extension の Schema 参照を GenExtension オブジェクトに変換する。
 *
 * protobuf-es v2 では extension に対して `role`（GenExtension 型）のみが export され、
 * v1 にあった `roleSchema` は存在しない。
 *
 * 例:
 *   import { role as roleExt, roleSchema } from "...permission_pb";
 *   hasOption(role, roleSchema)
 *   →
 *   import { role as roleExt } from "...permission_pb";
 *   hasOption(role, roleExt)
 */
const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const tracker = ProtobufIdentifierTracker.fromRoot(root, j);

  // schemaLocalName → resolvedLocalName
  const replacements = new Map<string, string>();

  // getOption/hasOption の第2引数で Schema 参照を検出
  root.find(j.CallExpression).forEach((path) => {
    const callee = path.node.callee;
    if (callee.type !== "Identifier" || !OPTION_FUNCTIONS.has(callee.name))
      return;

    const args = path.node.arguments;
    if (args.length < 2) return;

    const schemaArg = args[1];
    if (schemaArg.type !== "Identifier") return;

    const schemaLocalName = schemaArg.name;
    if (!tracker.isProtobufIdentifier(schemaLocalName)) return;

    const originalName = tracker.getOriginalName(schemaLocalName);
    if (!originalName || !isSchemaName(originalName)) return;

    // 既に解決済みならそのまま適用
    if (replacements.has(schemaLocalName)) {
      schemaArg.name = replacements.get(schemaLocalName)!;
      return;
    }

    const sourceFile = tracker.getSourceFile(schemaLocalName)!;
    const extensionName = originalName.slice(0, -SCHEMA_SUFFIX.length);

    // 同じソースから extensionName が既に import されているか確認
    let existingLocalName: string | undefined;
    root
      .find(j.ImportDeclaration, { source: { value: sourceFile } })
      .forEach((declPath) => {
        for (const specifier of declPath.node.specifiers ?? []) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported;
          if (imported.type !== "Identifier") continue;
          if (imported.name === extensionName) {
            const local = specifier.local;
            existingLocalName =
              (local?.type === "Identifier" ? local.name : undefined) ??
              imported.name;
          }
        }
      });

    let resolvedName: string;
    if (existingLocalName) {
      resolvedName = existingLocalName;
    } else {
      // extension が未 import → Schema import を extension にリネーム
      resolvedName = extensionName;
    }

    replacements.set(schemaLocalName, resolvedName);
    schemaArg.name = resolvedName;
  });

  if (replacements.size === 0) {
    return fileInfo.source;
  }

  // import の修正
  for (const [schemaLocalName, resolvedName] of replacements) {
    const sourceFile = tracker.getSourceFile(schemaLocalName)!;
    const originalName = tracker.getOriginalName(schemaLocalName)!;
    const extensionName = originalName.slice(0, -SCHEMA_SUFFIX.length);

    // 同じソースから extension が既に import されているか
    let extensionAlreadyImported = false;
    root
      .find(j.ImportDeclaration, { source: { value: sourceFile } })
      .forEach((declPath) => {
        for (const specifier of declPath.node.specifiers ?? []) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported;
          if (
            imported.type === "Identifier" &&
            imported.name === extensionName
          ) {
            extensionAlreadyImported = true;
          }
        }
      });

    if (extensionAlreadyImported) {
      // extension は既に import 済み → Schema の import specifier を削除
      const importManager = new ImportManager(root, j);
      importManager.removeNamedImport(sourceFile, schemaLocalName);
      importManager.apply();
    } else {
      // Schema import specifier を extension にリネーム
      root
        .find(j.ImportDeclaration, { source: { value: sourceFile } })
        .forEach((declPath) => {
          for (const specifier of declPath.node.specifiers ?? []) {
            if (specifier.type !== "ImportSpecifier") continue;
            const local = specifier.local;
            const localName =
              local?.type === "Identifier" ? local.name : undefined;
            const importedName = (specifier.imported as { name: string }).name;

            if (
              localName === schemaLocalName ||
              importedName === originalName
            ) {
              (specifier.imported as { name: string }).name = resolvedName;
              if (local && local.type === "Identifier") {
                local.name = resolvedName;
              }
            }
          }
        });
    }
  }

  return root.toSource();
};

export default transform;
export const parser = "tsx";
