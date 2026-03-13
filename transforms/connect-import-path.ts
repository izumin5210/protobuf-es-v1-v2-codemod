import type { Transform } from "jscodeshift";

const CONNECT_SUFFIX_PATTERN = /_connect(["'])/g;

/**
 * `_connect` サフィックスの import パスを `_pb` に書き換える。
 *
 * connect-es v2 では protoc-gen-connect-es が廃止され、
 * サービスディスクリプタは protoc-gen-es が生成する `_pb` ファイルに統合された。
 */
const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  let changed = false;

  root.find(j.ImportDeclaration).forEach((path) => {
    const source = path.node.source;
    if (typeof source.value !== "string") return;

    if (source.value.endsWith("_connect")) {
      source.value = source.value.replace(/_connect$/, "_pb");
      changed = true;
    }
  });

  if (!changed) {
    return fileInfo.source;
  }

  return root.toSource();
};

export default transform;
export const parser = "tsx";
