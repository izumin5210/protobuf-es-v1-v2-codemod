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

  // Track which schema names need to be added and from which source
  const schemasToAdd = new Map<string, string>();
  let needsCreateImport = false;

  // Find all `new X(...)` where X is a protobuf identifier
  root.find(j.NewExpression).forEach((path) => {
    const callee = path.node.callee;
    if (callee.type !== "Identifier") return;

    const name = callee.name;
    if (!tracker.isProtobufIdentifier(name)) return;

    const sourceFile = tracker.getSourceFile(name);
    if (!sourceFile) return;

    const originalName = tracker.getOriginalName(name) ?? name;
    const schemaName = toSchemaName(originalName);

    // Build arguments for create(): schema first, then optional init object
    const args: Parameters<typeof j.callExpression>[1] = [
      j.identifier(schemaName),
    ];
    if (path.node.arguments.length > 0) {
      args.push(...path.node.arguments);
    }

    // Replace `new X(init)` with `create(XSchema, init)`
    j(path).replaceWith(j.callExpression(j.identifier("create"), args));

    needsCreateImport = true;
    schemasToAdd.set(schemaName, sourceFile);
  });

  if (!needsCreateImport) {
    return fileInfo.source;
  }

  // Add schema imports -- use ImportManager for non-type-only sources,
  // handle type-only sources manually to avoid blank line from insertAfter
  const typeOnlySourceSchemas = new Map<string, string[]>();

  for (const [schemaName, sourceFile] of schemasToAdd) {
    // Check if ALL imports from this source are type-only
    const existingDecls = root.find(j.ImportDeclaration, {
      source: { value: sourceFile },
    });

    let hasValueImport = false;
    existingDecls.forEach((path) => {
      if (path.node.importKind !== "type") {
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

  // For type-only sources, insert a new value import declaration
  // directly into the program body to avoid the blank line issue
  for (const [sourceFile, schemaNames] of typeOnlySourceSchemas) {
    const specifiers = schemaNames.map((name) =>
      j.importSpecifier(j.identifier(name)),
    );
    const newDecl = j.importDeclaration(specifiers, j.literal(sourceFile));

    // Find the last import from this source and insert after it in the body
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
      // Fallback: insert at the end of imports
      let lastImportIndex = -1;
      for (let i = 0; i < body.length; i++) {
        if (body[i].type === "ImportDeclaration") {
          lastImportIndex = i;
        }
      }
      body.splice(lastImportIndex + 1, 0, newDecl);
    }
  }

  // Insert `import { create } from "@bufbuild/protobuf"` before the first import
  // so that third-party imports appear before local imports
  const existingCreateImport = root.find(j.ImportDeclaration, {
    source: { value: PROTOBUF_RUNTIME_PACKAGE },
  });

  if (existingCreateImport.length === 0) {
    const createImportDecl = j.importDeclaration(
      [j.importSpecifier(j.identifier("create"))],
      j.literal(PROTOBUF_RUNTIME_PACKAGE),
    );

    const program = root.find(j.Program).paths()[0];
    const body = program.node.body;

    // Find the first import declaration and insert before it
    const firstImportIndex = body.findIndex(
      (node) => node.type === "ImportDeclaration",
    );

    if (firstImportIndex >= 0) {
      body.splice(firstImportIndex, 0, createImportDecl);
    } else {
      body.unshift(createImportDecl);
    }
  } else {
    // Add `create` specifier to the existing import if not already present
    existingCreateImport.forEach((path) => {
      const specifiers = path.node.specifiers ?? [];
      const hasCreate = specifiers.some(
        (s) => s.type === "ImportSpecifier" && s.local?.name === "create",
      );
      if (!hasCreate) {
        specifiers.push(j.importSpecifier(j.identifier("create")));
      }
    });
  }

  return root.toSource();
};

export default transform;
export const parser = "tsx";
