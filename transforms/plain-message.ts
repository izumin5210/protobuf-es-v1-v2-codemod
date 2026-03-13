import type { Transform } from "jscodeshift";
import { ImportManager } from "../utils/import-manager.js";
import { ProtobufIdentifierTracker } from "../utils/protobuf-identifier-tracker.js";
import { toSchemaName } from "../utils/schema-name.js";

const PROTOBUF_RUNTIME_PACKAGE = "@bufbuild/protobuf";

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const tracker = ProtobufIdentifierTracker.fromRoot(root, j);
  const importManager = new ImportManager(root, j);

  let transformed = false;
  let needsMessageInitShape = false;
  const importsToRemove = new Set<string>();
  const schemasToAdd = new Map<string, string>();

  // Find all TSTypeReference nodes for PlainMessage<T> and PartialMessage<T>
  root.find(j.TSTypeReference).forEach((path) => {
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
      if (
        typeArg.type !== "TSTypeReference" ||
        typeArg.typeName.type !== "Identifier"
      )
        return;

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

      // Track schema import needed
      const sourceFile = tracker.getSourceFile(messageName);
      if (sourceFile) {
        schemasToAdd.set(schemaName, sourceFile);
      }
    }
  });

  // Second pass: Partial<T> where T is a protobuf message type
  root.find(j.TSTypeReference).forEach((path) => {
    const typeName = path.node.typeName;
    if (typeName.type !== "Identifier" || typeName.name !== "Partial") return;

    const typeParams = path.node.typeParameters;
    if (!typeParams || typeParams.params.length !== 1) return;

    const typeArg = typeParams.params[0];
    if (
      typeArg.type !== "TSTypeReference" ||
      typeArg.typeName.type !== "Identifier"
    )
      return;

    const messageName = typeArg.typeName.name;
    if (!tracker.isProtobufIdentifier(messageName)) return;

    const schemaName = toSchemaName(messageName);

    const replacement = j.tsTypeReference(
      j.identifier("MessageInitShape"),
      j.tsTypeParameterInstantiation([j.tsTypeQuery(j.identifier(schemaName))]),
    );

    j(path).replaceWith(replacement);
    transformed = true;
    needsMessageInitShape = true;

    const sourceFile = tracker.getSourceFile(messageName);
    if (sourceFile) {
      schemasToAdd.set(schemaName, sourceFile);
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
        const localName =
          s.local?.type === "Identifier" ? s.local.name : undefined;
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
  // that were kept, or Partial<T> was used without @bufbuild/protobuf import)
  if (needsMessageInitShape) {
    const existingProtobufImport = root.find(j.ImportDeclaration, {
      source: { value: PROTOBUF_RUNTIME_PACKAGE },
    });

    if (existingProtobufImport.length > 0) {
      importManager.addTypeImport(PROTOBUF_RUNTIME_PACKAGE, "MessageInitShape");
      importManager.apply();
    } else {
      // No existing @bufbuild/protobuf import; insert before the first import
      const messageInitShapeDecl = j.importDeclaration(
        [j.importSpecifier(j.identifier("MessageInitShape"))],
        j.literal(PROTOBUF_RUNTIME_PACKAGE),
      );
      messageInitShapeDecl.importKind = "type";

      const program = root.find(j.Program).paths()[0];
      const body = program.node.body;
      const firstImportIndex = body.findIndex(
        (node) => node.type === "ImportDeclaration",
      );

      if (firstImportIndex >= 0) {
        body.splice(firstImportIndex, 0, messageInitShapeDecl);
      } else {
        body.unshift(messageInitShapeDecl);
      }
    }
  }

  // Add schema imports using the same pattern as message-constructor.ts
  const typeOnlySourceSchemas = new Map<string, string[]>();

  for (const [schemaName, sourceFile] of schemasToAdd) {
    // Skip if schema is already imported
    let alreadyImported = false;
    root
      .find(j.ImportDeclaration, { source: { value: sourceFile } })
      .forEach((declPath) => {
        for (const s of declPath.node.specifiers ?? []) {
          if (s.type === "ImportSpecifier") {
            const localName =
              s.local?.type === "Identifier" ? s.local.name : undefined;
            const importedName =
              s.imported.type === "Identifier" ? s.imported.name : undefined;
            if (localName === schemaName || importedName === schemaName) {
              alreadyImported = true;
            }
          }
        }
      });
    if (alreadyImported) continue;

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
      const schemaImportManager = new ImportManager(root, j);
      schemaImportManager.addNamedImport(sourceFile, schemaName);
      schemaImportManager.apply();
    } else {
      const schemas = typeOnlySourceSchemas.get(sourceFile) ?? [];
      schemas.push(schemaName);
      typeOnlySourceSchemas.set(sourceFile, schemas);
    }
  }

  // For type-only sources, insert a new value import declaration
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
