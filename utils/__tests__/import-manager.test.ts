import { describe, it, expect } from "vitest";
import jscodeshift from "jscodeshift";
import { ImportManager } from "../import-manager.js";

const j = jscodeshift.withParser("tsx");

function applyImportManager(
  source: string,
  fn: (manager: ImportManager) => void,
): string {
  const root = j(source);
  const manager = new ImportManager(root, j);
  fn(manager);
  manager.apply();
  return root.toSource();
}

describe("ImportManager", () => {
  describe("addNamedImport", () => {
    it("adds a new import to an existing import declaration", () => {
      const result = applyImportManager(
        `import { User } from "./gen/example_pb";`,
        (m) => m.addNamedImport("./gen/example_pb", "UserSchema"),
      );
      expect(result).toContain("UserSchema");
      expect(result).toContain("User");
    });

    it("creates a new import declaration when source does not exist", () => {
      const result = applyImportManager(
        `import { User } from "./gen/example_pb";`,
        (m) => m.addNamedImport("@bufbuild/protobuf", "create"),
      );
      expect(result).toContain('import { create } from "@bufbuild/protobuf"');
    });

    it("does not add duplicate imports", () => {
      const result = applyImportManager(
        `import { User } from "./gen/example_pb";`,
        (m) => m.addNamedImport("./gen/example_pb", "User"),
      );
      const matches = result.match(/User/g);
      expect(matches?.length).toBe(1);
    });

    it("adds to type-only import declaration as a separate value import", () => {
      const result = applyImportManager(
        `import type { User } from "./gen/example_pb";`,
        (m) => m.addNamedImport("./gen/example_pb", "UserSchema"),
      );
      // type import はそのまま残り、value import が別途追加される
      expect(result).toContain("import type { User }");
      expect(result).toContain("UserSchema");
    });
  });

  describe("addTypeImport", () => {
    it("adds a type import specifier", () => {
      const result = applyImportManager(
        `import { create } from "@bufbuild/protobuf";`,
        (m) => m.addTypeImport("@bufbuild/protobuf", "MessageInitShape"),
      );
      expect(result).toContain("MessageInitShape");
    });
  });

  describe("removeNamedImport", () => {
    it("removes a specifier from an import declaration", () => {
      const result = applyImportManager(
        `import { User, Post } from "./gen/example_pb";`,
        (m) => m.removeNamedImport("./gen/example_pb", "User"),
      );
      expect(result).not.toContain("User");
      expect(result).toContain("Post");
    });

    it("removes the entire import declaration when last specifier is removed", () => {
      const result = applyImportManager(
        `import { User } from "./gen/example_pb";`,
        (m) => m.removeNamedImport("./gen/example_pb", "User"),
      );
      expect(result.trim()).toBe("");
    });
  });

  describe("complex scenarios", () => {
    it("handles adding multiple imports from different sources", () => {
      const result = applyImportManager(
        `import { User } from "./gen/example_pb";`,
        (m) => {
          m.addNamedImport("@bufbuild/protobuf", "create");
          m.addNamedImport("@bufbuild/protobuf", "fromBinary");
          m.addNamedImport("./gen/example_pb", "UserSchema");
        },
      );
      expect(result).toContain("create");
      expect(result).toContain("fromBinary");
      expect(result).toContain("UserSchema");
    });
  });
});
