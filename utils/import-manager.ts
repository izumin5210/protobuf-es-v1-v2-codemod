import type { Collection, JSCodeshift } from "jscodeshift";

interface PendingImport {
  name: string;
  isType: boolean;
}

/**
 * AST に対するインポートの追加・削除を管理する。
 * 変更は `apply()` 呼び出し時にまとめて適用される。
 */
export class ImportManager {
  private root: Collection;
  private j: JSCodeshift;
  private toAdd = new Map<string, PendingImport[]>();
  private toRemove = new Map<string, Set<string>>();

  constructor(root: Collection, j: JSCodeshift) {
    this.root = root;
    this.j = j;
  }

  addNamedImport(source: string, name: string): void {
    const pending = this.toAdd.get(source) ?? [];
    if (!pending.some((p) => p.name === name && !p.isType)) {
      pending.push({ name, isType: false });
    }
    this.toAdd.set(source, pending);
  }

  addTypeImport(source: string, name: string): void {
    const pending = this.toAdd.get(source) ?? [];
    if (!pending.some((p) => p.name === name && p.isType)) {
      pending.push({ name, isType: true });
    }
    this.toAdd.set(source, pending);
  }

  removeNamedImport(source: string, name: string): void {
    const names = this.toRemove.get(source) ?? new Set();
    names.add(name);
    this.toRemove.set(source, names);
  }

  apply(): void {
    this.applyRemovals();
    this.applyAdditions();
  }

  private applyRemovals(): void {
    for (const [source, names] of this.toRemove) {
      this.root
        .find(this.j.ImportDeclaration, { source: { value: source } })
        .forEach((path) => {
          const specifiers = path.node.specifiers ?? [];
          path.node.specifiers = specifiers.filter((s) => {
            if (s.type !== "ImportSpecifier") return true;
            const local = s.local;
            const localName = local?.type === "Identifier" ? local.name : undefined;
            return !localName || !names.has(localName);
          });

          if (path.node.specifiers.length === 0) {
            path.prune();
          }
        });
    }
  }

  private applyAdditions(): void {
    for (const [source, pendingImports] of this.toAdd) {
      const valueImports = pendingImports.filter((p) => !p.isType);
      const typeImports = pendingImports.filter((p) => p.isType);

      if (valueImports.length > 0) {
        this.addToSource(source, valueImports, false);
      }
      if (typeImports.length > 0) {
        this.addToSource(source, typeImports, true);
      }
    }
  }

  private addToSource(
    source: string,
    imports: PendingImport[],
    isType: boolean,
  ): void {
    const existingDecls = this.root.find(this.j.ImportDeclaration, {
      source: { value: source },
    });

    // 既存の value import 宣言を探す (type-only でないもの)
    let targetDecl: ReturnType<typeof existingDecls.paths>[number] | undefined;
    existingDecls.forEach((path) => {
      const matchesKind = isType
        ? path.node.importKind === "type"
        : path.node.importKind !== "type";
      if (matchesKind && !targetDecl) {
        targetDecl = path;
      }
    });

    const newNames = imports.map((p) => p.name);

    if (targetDecl) {
      const existing = new Set(
        (targetDecl.node.specifiers ?? [])
          .filter((s): s is ReturnType<typeof this.j.importSpecifier> =>
            s.type === "ImportSpecifier",
          )
          .map((s) => s.local?.name ?? (s.imported as { name: string }).name),
      );

      for (const name of newNames) {
        if (!existing.has(name)) {
          targetDecl.node.specifiers ??= [];
          targetDecl.node.specifiers.push(
            this.j.importSpecifier(this.j.identifier(name)),
          );
        }
      }
    } else {
      const specifiers = newNames.map((name) =>
        this.j.importSpecifier(this.j.identifier(name)),
      );
      const decl = this.j.importDeclaration(
        specifiers,
        this.j.literal(source),
      );
      if (isType) {
        decl.importKind = "type";
      }

      // 最後の import 宣言の後に追加
      const allImports = this.root.find(this.j.ImportDeclaration);
      if (allImports.length > 0) {
        allImports.at(-1).insertAfter(decl);
      } else {
        // import がない場合はファイル先頭に追加
        const body = this.root.find(this.j.Program);
        body.forEach((path) => {
          path.node.body.unshift(decl);
        });
      }
    }
  }
}
