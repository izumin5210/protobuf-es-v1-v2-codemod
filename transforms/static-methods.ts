import type { Transform } from "jscodeshift";
import { ImportManager } from "../utils/import-manager.js";
import { ProtobufIdentifierTracker } from "../utils/protobuf-identifier-tracker.js";
import { toSchemaName } from "../utils/schema-name.js";

const PROTOBUF_RUNTIME_PACKAGE = "@bufbuild/protobuf";

const STATIC_METHODS = new Set(["fromBinary", "fromJson", "fromJsonString"]);

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const tracker = ProtobufIdentifierTracker.fromRoot(root, j);
  const importManager = new ImportManager(root, j);

  // Track which schema names need to be added and from which source
  const schemasToAdd = new Map<string, string>();
  // Track which runtime functions need to be imported
  const runtimeFunctionsToAdd = new Set<string>();

  // Find all `X.fromBinary(...)`, `X.fromJson(...)`, `X.fromJsonString(...)` calls
  // where X is a protobuf identifier
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const callee = path.node.callee;
      if (callee.type !== "MemberExpression") return;

      const object = callee.object;
      const property = callee.property;

      if (object.type !== "Identifier") return;
      if (property.type !== "Identifier") return;

      const messageName = object.name;
      const methodName = property.name;

      if (!STATIC_METHODS.has(methodName)) return;
      if (!tracker.isProtobufIdentifier(messageName)) return;

      const sourceFile = tracker.getSourceFile(messageName);
      if (!sourceFile) return;

      const originalName = tracker.getOriginalName(messageName) ?? messageName;
      const schemaName = toSchemaName(originalName);

      // Build arguments: schema first, then original arguments
      const args = [j.identifier(schemaName), ...path.node.arguments];

      // Replace `X.fromXxx(args...)` with `fromXxx(XSchema, args...)`
      j(path).replaceWith(j.callExpression(j.identifier(methodName), args));

      runtimeFunctionsToAdd.add(methodName);
      schemasToAdd.set(schemaName, sourceFile);
    });

  if (runtimeFunctionsToAdd.size === 0) {
    return fileInfo.source;
  }

  // Handle schema imports -- type-only sources need special treatment
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

  // Insert runtime function imports from @bufbuild/protobuf
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

    // Insert before the first import so third-party imports appear first
    const firstImportIndex = body.findIndex(
      (node) => node.type === "ImportDeclaration",
    );

    if (firstImportIndex >= 0) {
      body.splice(firstImportIndex, 0, runtimeImportDecl);
    } else {
      body.unshift(runtimeImportDecl);
    }
  } else {
    // Add function specifiers to the existing import if not already present
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
};

export default transform;
export const parser = "tsx";
