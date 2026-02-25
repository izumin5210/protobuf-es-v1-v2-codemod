import type { Transform } from "jscodeshift";
import { ImportManager } from "../utils/import-manager.js";
import { toSchemaName } from "../utils/schema-name.js";

const PROTOBUF_RUNTIME_PACKAGE = "@bufbuild/protobuf";

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const importManager = new ImportManager(root, j);

  let transformed = false;
  let needsMessageInitShape = false;
  const importsToRemove = new Set<string>();

  // Find all TSTypeReference nodes for PlainMessage<T> and PartialMessage<T>
  root
    .find(j.TSTypeReference)
    .forEach((path) => {
      const typeName = path.node.typeName;
      if (typeName.type !== "Identifier") return;

      const name = typeName.name;
      if (name !== "PlainMessage" && name !== "PartialMessage") return;

      const typeParams = path.node.typeParameters;
      if (!typeParams || typeParams.params.length !== 1) return;

      const typeArg = typeParams.params[0];

      if (name === "PlainMessage") {
        // PlainMessage<T> -> T
        j(path).replaceWith(typeArg);
        transformed = true;
        importsToRemove.add("PlainMessage");
      } else {
        // PartialMessage<T> -> MessageInitShape<typeof TSchema>
        if (typeArg.type !== "TSTypeReference" || typeArg.typeName.type !== "Identifier") return;

        const messageName = typeArg.typeName.name;
        const schemaName = toSchemaName(messageName);

        const replacement = j.tsTypeReference(
          j.identifier("MessageInitShape"),
          j.tsTypeParameterInstantiation([
            j.tsTypeQuery(j.identifier(schemaName)),
          ]),
        );

        j(path).replaceWith(replacement);
        transformed = true;
        needsMessageInitShape = true;
        importsToRemove.add("PartialMessage");
      }
    });

  if (!transformed) {
    return fileInfo.source;
  }

  // Handle @bufbuild/protobuf imports: remove PlainMessage/PartialMessage,
  // add MessageInitShape if needed. We do this directly on the import
  // declaration to preserve its position in the file.
  root
    .find(j.ImportDeclaration, { source: { value: PROTOBUF_RUNTIME_PACKAGE } })
    .forEach((path) => {
      const specifiers = path.node.specifiers ?? [];

      // Remove PlainMessage and PartialMessage specifiers
      path.node.specifiers = specifiers.filter((s) => {
        if (s.type !== "ImportSpecifier") return true;
        const localName = s.local?.type === "Identifier" ? s.local.name : undefined;
        return !localName || !importsToRemove.has(localName);
      });

      // If all specifiers are removed, replace with MessageInitShape type import
      // or prune the declaration
      if (path.node.specifiers.length === 0) {
        if (needsMessageInitShape) {
          // Replace the whole declaration with a type import for MessageInitShape
          const newDecl = j.importDeclaration(
            [j.importSpecifier(j.identifier("MessageInitShape"))],
            j.literal(PROTOBUF_RUNTIME_PACKAGE),
          );
          newDecl.importKind = "type";
          j(path).replaceWith(newDecl);
          needsMessageInitShape = false;
        } else {
          path.prune();
        }
      }
    });

  // If we still need MessageInitShape (e.g. the original import had other specifiers
  // that were kept), add it via ImportManager
  if (needsMessageInitShape) {
    importManager.addTypeImport(PROTOBUF_RUNTIME_PACKAGE, "MessageInitShape");
    importManager.apply();
  }

  return root.toSource();
};

export default transform;
export const parser = "tsx";
