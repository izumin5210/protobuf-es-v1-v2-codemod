import { Schema } from "@bufbuild/protoplugin/ecmascript";
import { createEcmaScriptPlugin, runNodeJs } from "@bufbuild/protoplugin";

function generateTs(schema: Schema) {
  console.log(schema);
}
