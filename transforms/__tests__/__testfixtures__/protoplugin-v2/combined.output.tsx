import { getOption } from "@bufbuild/protobuf";
import { createEcmaScriptPlugin, runNodeJs } from "@bufbuild/protoplugin";
import { tag as tagExt } from "@example/gen/example/v1/example_pb";

import type { Schema } from "@bufbuild/protoplugin";

function generateTs(schema: Schema) {
  const f = schema.generateFile("test.ts");
  const registryExpr = f.import("IRegistry", "../registry", true);

  for (const item of tagDesc.values) {
    f.print(`  [Category.${item.localName}]: [`);
    const { metadata } = getOption(item, tagExt);
    f.print(f.jsDoc(item));
  }
}
