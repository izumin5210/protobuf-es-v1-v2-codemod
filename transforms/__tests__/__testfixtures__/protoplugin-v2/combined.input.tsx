import { getExtension } from "@bufbuild/protobuf";
import { createEcmaScriptPlugin, runNodeJs } from "@bufbuild/protoplugin";
import { localName } from "@bufbuild/protoplugin/ecmascript";
import { tag as tagExt } from "@example/gen/example/v1/example_pb";

import type { Schema } from "@bufbuild/protoplugin/ecmascript";

function generateTs(schema: Schema) {
  const f = schema.generateFile("test.ts");
  const registryExpr = f.import("IRegistry", "../registry").toTypeOnly();

  for (const item of tagDesc.values) {
    f.print(`  [Category.${localName(item)}]: [`);
    const { metadata } = getExtension(item.proto.options, tagExt);
    f.jsDoc(item);
  }
}
