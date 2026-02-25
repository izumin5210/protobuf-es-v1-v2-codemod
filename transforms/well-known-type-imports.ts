import type { Transform } from "jscodeshift";

const BUFBUILD_PROTOBUF = "@bufbuild/protobuf";
const BUFBUILD_PROTOBUF_WKT = "@bufbuild/protobuf/wkt";

// Well-known type base names
const WKT_BASE_NAMES = [
  // Core
  "Any",
  "Duration",
  "Timestamp",
  "Struct",
  "Value",
  "ListValue",
  "Empty",
  "FieldMask",
  "NullValue",
  // Wrappers
  "DoubleValue",
  "FloatValue",
  "Int64Value",
  "UInt64Value",
  "Int32Value",
  "UInt32Value",
  "BoolValue",
  "StringValue",
  "BytesValue",
  // Other
  "Api",
  "Method",
  "Mixin",
  "Type",
  "Field",
  "Enum",
  "EnumValue",
  "Option",
  "SourceContext",
] as const;

// Include both the type names and their Schema counterparts
const WELL_KNOWN_TYPES = new Set<string>(
  WKT_BASE_NAMES.flatMap((name) => [name, `${name}Schema`]),
);

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  let hasChanges = false;

  root
    .find(j.ImportDeclaration, { source: { value: BUFBUILD_PROTOBUF } })
    .forEach((path) => {
      const specifiers = path.node.specifiers ?? [];
      const importKind = path.node.importKind;

      // Only handle named import specifiers
      const namedSpecifiers = specifiers.filter(
        (s) => s.type === "ImportSpecifier",
      );
      if (namedSpecifiers.length === 0) return;

      const wktSpecifiers = namedSpecifiers.filter((s) => {
        if (s.type !== "ImportSpecifier") return false;
        const imported = s.imported;
        if (imported.type !== "Identifier") return false;
        return WELL_KNOWN_TYPES.has(imported.name);
      });

      const nonWktSpecifiers = namedSpecifiers.filter((s) => {
        if (s.type !== "ImportSpecifier") return false;
        const imported = s.imported;
        if (imported.type !== "Identifier") return false;
        return !WELL_KNOWN_TYPES.has(imported.name);
      });

      if (wktSpecifiers.length === 0) {
        // No WKT imports, nothing to do
        return;
      }

      hasChanges = true;

      if (nonWktSpecifiers.length === 0) {
        // All specifiers are WKT -- just change the source
        path.node.source = j.literal(BUFBUILD_PROTOBUF_WKT);
      } else {
        // Mixed: keep non-WKT in the original declaration, create new for WKT
        path.node.specifiers = nonWktSpecifiers;

        const wktImport = j.importDeclaration(
          wktSpecifiers,
          j.literal(BUFBUILD_PROTOBUF_WKT),
        );
        if (importKind === "type") {
          wktImport.importKind = "type";
        }

        path.insertAfter(wktImport);
      }
    });

  if (!hasChanges) {
    return fileInfo.source;
  }

  return root.toSource();
};

export default transform;
export const parser = "tsx";
