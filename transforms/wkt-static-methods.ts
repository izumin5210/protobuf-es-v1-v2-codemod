import type { Transform } from "jscodeshift";

const WKT_PACKAGE = "@bufbuild/protobuf/wkt";

/**
 * WKT (Well-Known Types) の静的メソッド呼び出しをスタンドアロン関数に変換する。
 *
 * - `Timestamp.fromDate(date)` → `timestampFromDate(date)`
 * - `Timestamp.now()` → `timestampNow()`
 *
 * 対象は `@bufbuild/protobuf/wkt` から import された WKT 型のみ。
 */

// WKT型名 → { 静的メソッド名 → スタンドアロン関数名 }
const WKT_STATIC_METHOD_MAP: Record<string, Record<string, string>> = {
  Timestamp: {
    fromDate: "timestampFromDate",
    now: "timestampNow",
    fromMs: "timestampFromMs",
  },
  Duration: {
    from: "durationFrom",
    fromMs: "durationFromMs",
  },
};

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // @bufbuild/protobuf/wkt から import された WKT 型を追跡
  const wktIdentifiers = new Map<string, string>(); // localName → originalName

  root
    .find(j.ImportDeclaration, { source: { value: WKT_PACKAGE } })
    .forEach((path) => {
      for (const specifier of path.node.specifiers ?? []) {
        if (specifier.type !== "ImportSpecifier") continue;
        const imported = specifier.imported;
        if (imported.type !== "Identifier") continue;
        const localName =
          specifier.local?.type === "Identifier"
            ? specifier.local.name
            : imported.name;
        if (WKT_STATIC_METHOD_MAP[imported.name]) {
          wktIdentifiers.set(localName, imported.name);
        }
      }
    });

  if (wktIdentifiers.size === 0) {
    return fileInfo.source;
  }

  const functionsToAdd = new Set<string>();
  const wktTypesToRemove = new Set<string>();

  // WKT型.staticMethod(args) → standaloneFunction(args) に変換
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const callee = path.node.callee;
      if (callee.type !== "MemberExpression") return;

      const object = callee.object;
      const property = callee.property;
      if (object.type !== "Identifier" || property.type !== "Identifier")
        return;

      const originalName = wktIdentifiers.get(object.name);
      if (!originalName) return;

      const methodMap = WKT_STATIC_METHOD_MAP[originalName];
      if (!methodMap) return;

      const standaloneName = methodMap[property.name];
      if (!standaloneName) return;

      // `WKTType.method(args)` → `standaloneFunction(args)`
      j(path).replaceWith(
        j.callExpression(j.identifier(standaloneName), [
          ...path.node.arguments,
        ]),
      );

      functionsToAdd.add(standaloneName);
      wktTypesToRemove.add(object.name);
    });

  if (functionsToAdd.size === 0) {
    return fileInfo.source;
  }

  // WKT 型が他の箇所で使われているか確認（型注釈など）
  for (const localName of wktTypesToRemove) {
    const usages = root.find(j.Identifier, { name: localName });
    let usedElsewhere = false;
    usages.forEach((idPath) => {
      // import specifier 内は除外
      if (idPath.parent.node.type === "ImportSpecifier") return;
      usedElsewhere = true;
    });
    if (usedElsewhere) {
      wktTypesToRemove.delete(localName);
    }
  }

  // import 宣言の書き換え: 不要な WKT 型を削除し、スタンドアロン関数を追加
  root
    .find(j.ImportDeclaration, { source: { value: WKT_PACKAGE } })
    .forEach((path) => {
      const specifiers = path.node.specifiers ?? [];

      // 使われなくなった WKT 型の specifier を除去
      path.node.specifiers = specifiers.filter((s) => {
        if (s.type !== "ImportSpecifier") return true;
        const localName =
          s.local?.type === "Identifier" ? s.local.name : undefined;
        const importedName =
          s.imported.type === "Identifier" ? s.imported.name : undefined;
        const name = localName ?? importedName;
        return !name || !wktTypesToRemove.has(name);
      });

      // スタンドアロン関数を追加
      for (const funcName of [...functionsToAdd].sort()) {
        const alreadyImported = (path.node.specifiers ?? []).some(
          (s) => s.type === "ImportSpecifier" && s.local?.name === funcName,
        );
        if (!alreadyImported) {
          path.node.specifiers ??= [];
          path.node.specifiers.push(j.importSpecifier(j.identifier(funcName)));
        }
      }
    });

  return root.toSource();
};

export default transform;
export const parser = "tsx";
