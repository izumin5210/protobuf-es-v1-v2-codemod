import type { Collection, JSCodeshift } from "jscodeshift";

const PB_FILE_PATTERN = /_pb(?:\.[jt]sx?)?$/;

interface TrackedIdentifier {
  localName: string;
  originalName: string;
  sourceFile: string;
  isTypeOnly: boolean;
}

/**
 * `*_pb` ファイルからインポートされた protobuf メッセージ識別子を追跡する。
 * 全 transform がこのクラスに依存して protobuf 関連の識別子を特定する。
 */
export class ProtobufIdentifierTracker {
  private identifiers = new Map<string, TrackedIdentifier>();

  static fromRoot(root: Collection, j: JSCodeshift): ProtobufIdentifierTracker {
    const tracker = new ProtobufIdentifierTracker();
    tracker.collectFromImports(root, j);
    return tracker;
  }

  isProtobufIdentifier(name: string): boolean {
    return this.identifiers.has(name);
  }

  getSourceFile(name: string): string | undefined {
    return this.identifiers.get(name)?.sourceFile;
  }

  getOriginalName(name: string): string | undefined {
    return this.identifiers.get(name)?.originalName;
  }

  isTypeOnlyImport(name: string): boolean {
    return this.identifiers.get(name)?.isTypeOnly ?? false;
  }

  private collectFromImports(root: Collection, j: JSCodeshift): void {
    root.find(j.ImportDeclaration).forEach((path) => {
      const source = path.node.source.value;
      if (typeof source !== "string" || !PB_FILE_PATTERN.test(source)) {
        return;
      }

      const isDeclarationTypeOnly = path.node.importKind === "type";

      for (const specifier of path.node.specifiers ?? []) {
        if (specifier.type !== "ImportSpecifier") continue;

        const imported = specifier.imported;
        if (imported.type !== "Identifier") continue;

        const local = specifier.local;
        const localName =
          (local?.type === "Identifier" ? local.name : undefined) ??
          imported.name;
        const originalName = imported.name;

        const isTypeOnly =
          isDeclarationTypeOnly ||
          (specifier as unknown as { importKind?: string }).importKind ===
            "type";

        this.identifiers.set(localName, {
          localName,
          originalName,
          sourceFile: source,
          isTypeOnly,
        });
      }
    });
  }
}
