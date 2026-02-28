import type { Transform } from "jscodeshift";

const PROTOPLUGIN_ECMASCRIPT = "@bufbuild/protoplugin/ecmascript";
const PROTOPLUGIN = "@bufbuild/protoplugin";
const PROTOBUF = "@bufbuild/protobuf";

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  let transformed = false;

  // Check if file uses protoplugin at all
  const hasProtopluginImport = root.find(j.ImportDeclaration).some((path) => {
    const source = path.node.source.value;
    return source === PROTOPLUGIN_ECMASCRIPT || source === PROTOPLUGIN;
  });
  const hasGetExtensionImport = root.find(j.ImportDeclaration).some((path) => {
    const source = path.node.source.value;
    if (source !== PROTOBUF) return false;
    return (path.node.specifiers ?? []).some(
      (s) =>
        s.type === "ImportSpecifier" &&
        s.imported.type === "Identifier" &&
        s.imported.name === "getExtension",
    );
  });

  if (!hasProtopluginImport && !hasGetExtensionImport) {
    return fileInfo.source;
  }

  // Track localName imports from protoplugin/ecmascript for removal
  const localNameImported = new Set<string>();

  // Pattern A: Rewrite import paths from @bufbuild/protoplugin/ecmascript to @bufbuild/protoplugin
  root
    .find(j.ImportDeclaration, { source: { value: PROTOPLUGIN_ECMASCRIPT } })
    .forEach((path) => {
      // Collect localName imports before rewriting
      for (const s of path.node.specifiers ?? []) {
        if (
          s.type === "ImportSpecifier" &&
          s.imported.type === "Identifier" &&
          s.imported.name === "localName"
        ) {
          const localIdent = s.local?.type === "Identifier" ? s.local.name : "localName";
          localNameImported.add(localIdent);
        }
      }

      // Check if there's already an import from @bufbuild/protoplugin with matching kind
      const importKind = path.node.importKind ?? "value";
      const existingProtoplugin = root.find(j.ImportDeclaration, {
        source: { value: PROTOPLUGIN },
      });

      let merged = false;
      existingProtoplugin.forEach((existingPath) => {
        const existingKind = existingPath.node.importKind ?? "value";
        if (existingKind === importKind && !merged) {
          // Merge specifiers into existing import
          const existingNames = new Set(
            (existingPath.node.specifiers ?? [])
              .filter((s): s is ReturnType<typeof j.importSpecifier> => s.type === "ImportSpecifier")
              .map((s) => s.imported.type === "Identifier" ? s.imported.name : ""),
          );
          for (const s of path.node.specifiers ?? []) {
            if (s.type === "ImportSpecifier" && s.imported.type === "Identifier") {
              if (!existingNames.has(s.imported.name)) {
                existingPath.node.specifiers ??= [];
                existingPath.node.specifiers.push(s);
              }
            }
          }
          path.prune();
          merged = true;
        }
      });

      if (!merged) {
        path.node.source = j.literal(PROTOPLUGIN);
        transformed = true;
      } else {
        transformed = true;
      }
    });

  // Pattern B: localName(value) → value.localName
  // Remove localName import and transform all call sites
  if (localNameImported.size > 0) {
    root.find(j.CallExpression).forEach((path) => {
      const callee = path.node.callee;
      if (callee.type !== "Identifier" || !localNameImported.has(callee.name)) return;

      const args = path.node.arguments;
      if (args.length !== 1 || args[0].type === "SpreadElement") return;

      // localName(x) → x.localName
      j(path).replaceWith(
        j.memberExpression(args[0], j.identifier("localName")),
      );
      transformed = true;
    });

    // Remove localName from imports
    root.find(j.ImportDeclaration, { source: { value: PROTOPLUGIN } }).forEach((path) => {
      const specifiers = path.node.specifiers ?? [];
      path.node.specifiers = specifiers.filter((s) => {
        if (s.type !== "ImportSpecifier") return true;
        const importedName = s.imported.type === "Identifier" ? s.imported.name : undefined;
        return importedName !== "localName";
      });
      if (path.node.specifiers.length === 0) {
        path.prune();
      }
    });
  }

  // Pattern C: f.import(name, from).toTypeOnly() → f.import(name, from, true)
  root.find(j.CallExpression).forEach((path) => {
    const callee = path.node.callee;
    if (callee.type !== "MemberExpression") return;
    if (callee.property.type !== "Identifier" || callee.property.name !== "toTypeOnly") return;

    // The object should be a call expression: f.import(name, from)
    const innerCall = callee.object;
    if (innerCall.type !== "CallExpression") return;
    if (innerCall.callee.type !== "MemberExpression") return;
    if (innerCall.callee.property.type !== "Identifier" || innerCall.callee.property.name !== "import") return;

    // Replace: f.import(name, from).toTypeOnly() → f.import(name, from, true)
    innerCall.arguments.push(j.booleanLiteral(true));
    j(path).replaceWith(innerCall);
    transformed = true;
  });

  // Pattern D: f.jsDoc(desc) as ExpressionStatement → f.print(f.jsDoc(desc))
  root.find(j.ExpressionStatement).forEach((path) => {
    const expr = path.node.expression;
    if (expr.type !== "CallExpression") return;
    if (expr.callee.type !== "MemberExpression") return;
    if (expr.callee.property.type !== "Identifier" || expr.callee.property.name !== "jsDoc") return;

    const receiver = expr.callee.object;

    // Wrap in f.print(f.jsDoc(...))
    const printCall = j.callExpression(
      j.memberExpression(receiver, j.identifier("print")),
      [expr],
    );
    path.node.expression = printCall;
    transformed = true;
  });

  // Pattern E: getExtension(x.proto.options, ext) → getOption(x, ext)
  let needsGetOptionImport = false;
  root.find(j.CallExpression).forEach((path) => {
    const callee = path.node.callee;
    if (callee.type !== "Identifier" || callee.name !== "getExtension") return;

    const args = path.node.arguments;
    if (args.length !== 2) return;

    const firstArg = args[0];
    // Match pattern: x.proto.options
    if (
      firstArg.type === "MemberExpression" &&
      firstArg.property.type === "Identifier" &&
      firstArg.property.name === "options" &&
      firstArg.object.type === "MemberExpression" &&
      firstArg.object.property.type === "Identifier" &&
      firstArg.object.property.name === "proto"
    ) {
      // Extract x from x.proto.options
      const baseObj = firstArg.object.object;
      callee.name = "getOption";
      args[0] = baseObj;
      needsGetOptionImport = true;
      transformed = true;
    }
  });

  // Rename getExtension import to getOption
  if (needsGetOptionImport) {
    root.find(j.ImportDeclaration, { source: { value: PROTOBUF } }).forEach((path) => {
      const specifiers = path.node.specifiers ?? [];
      for (const s of specifiers) {
        if (
          s.type === "ImportSpecifier" &&
          s.imported.type === "Identifier" &&
          s.imported.name === "getExtension"
        ) {
          s.imported.name = "getOption";
          if (s.local?.type === "Identifier" && s.local.name === "getExtension") {
            s.local.name = "getOption";
          }
        }
      }
    });
  }

  if (!transformed) {
    return fileInfo.source;
  }

  return root.toSource();
};

export default transform;
export const parser = "tsx";
