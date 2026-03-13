import type { Transform } from "jscodeshift";

const CONNECT_PACKAGE = "@connectrpc/connect";
const PROTOBUF_PACKAGE = "@bufbuild/protobuf";

/**
 * connect-es v1 → v2 のクライアント型・関数の名前変更を行う。
 *
 * - `PromiseClient` → `Client`
 * - `createPromiseClient` → `createClient`
 *   - ローカルに `createClient` が定義されている場合は `connectCreateClient` にリネーム
 * - `ServiceType` (from @bufbuild/protobuf) → `DescService`
 */
const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  let changed = false;

  // ローカルに createClient という名前の宣言があるかチェック
  const hasLocalCreateClient =
    root.find(j.FunctionDeclaration, { id: { name: "createClient" } }).length > 0 ||
    root.find(j.VariableDeclarator, { id: { name: "createClient" } }).length > 0;

  // @connectrpc/connect からの import を書き換え
  // imported と local が同一ノードの場合があるため、specifier 自体を置換する
  root
    .find(j.ImportDeclaration, { source: { value: CONNECT_PACKAGE } })
    .forEach((path) => {
      path.node.specifiers = (path.node.specifiers ?? []).map((specifier) => {
        if (specifier.type !== "ImportSpecifier") return specifier;
        const imported = specifier.imported;
        if (imported.type !== "Identifier") return specifier;

        if (imported.name === "PromiseClient") {
          changed = true;
          return j.importSpecifier(j.identifier("Client"));
        }

        if (imported.name === "createPromiseClient") {
          changed = true;
          if (hasLocalCreateClient) {
            return j.importSpecifier(
              j.identifier("createClient"),
              j.identifier("connectCreateClient"),
            );
          }
          return j.importSpecifier(j.identifier("createClient"));
        }

        return specifier;
      });
    });

  // @bufbuild/protobuf からの ServiceType → DescService 書き換え
  root
    .find(j.ImportDeclaration, { source: { value: PROTOBUF_PACKAGE } })
    .forEach((path) => {
      path.node.specifiers = (path.node.specifiers ?? []).map((specifier) => {
        if (specifier.type !== "ImportSpecifier") return specifier;
        const imported = specifier.imported;
        if (imported.type !== "Identifier") return specifier;

        if (imported.name === "ServiceType") {
          changed = true;
          const newSpec = j.importSpecifier(j.identifier("DescService"));
          // importKind を引き継ぐ (type specifier の場合)
          const oldKind = (specifier as unknown as { importKind?: string }).importKind;
          if (oldKind) {
            (newSpec as unknown as { importKind?: string }).importKind = oldKind;
          }
          return newSpec;
        }

        return specifier;
      });
    });

  if (!changed) {
    return fileInfo.source;
  }

  // コード中の PromiseClient, createPromiseClient, ServiceType 参照を書き換え
  root
    .find(j.Identifier, { name: "PromiseClient" })
    .forEach((path) => {
      // import specifier 内は既に書き換え済み
      if (path.parent.node.type === "ImportSpecifier") return;
      path.node.name = "Client";
    });

  root
    .find(j.Identifier, { name: "createPromiseClient" })
    .forEach((path) => {
      if (path.parent.node.type === "ImportSpecifier") return;
      path.node.name = hasLocalCreateClient ? "connectCreateClient" : "createClient";
    });

  root
    .find(j.Identifier, { name: "ServiceType" })
    .forEach((path) => {
      if (path.parent.node.type === "ImportSpecifier") return;
      path.node.name = "DescService";
    });

  return root.toSource();
};

export default transform;
export const parser = "tsx";
