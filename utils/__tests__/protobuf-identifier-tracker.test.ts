import { describe, it, expect } from "vitest";
import jscodeshift from "jscodeshift";
import { ProtobufIdentifierTracker } from "../protobuf-identifier-tracker.js";

const j = jscodeshift.withParser("tsx");

function createTracker(source: string): ProtobufIdentifierTracker {
  const root = j(source);
  return ProtobufIdentifierTracker.fromRoot(root, j);
}

describe("ProtobufIdentifierTracker", () => {
  describe("fromRoot", () => {
    it("tracks named imports from *_pb files", () => {
      const tracker = createTracker(`
        import { User, Post } from "./gen/example_pb";
      `);
      expect(tracker.isProtobufIdentifier("User")).toBe(true);
      expect(tracker.isProtobufIdentifier("Post")).toBe(true);
      expect(tracker.isProtobufIdentifier("Unknown")).toBe(false);
    });

    it("tracks type imports from *_pb files", () => {
      const tracker = createTracker(`
        import type { User } from "./gen/example_pb";
      `);
      expect(tracker.isProtobufIdentifier("User")).toBe(true);
    });

    it("tracks inline type specifiers from *_pb files", () => {
      const tracker = createTracker(`
        import { type User, Post } from "./gen/example_pb";
      `);
      expect(tracker.isProtobufIdentifier("User")).toBe(true);
      expect(tracker.isProtobufIdentifier("Post")).toBe(true);
    });

    it("does not track imports from non-_pb files", () => {
      const tracker = createTracker(`
        import { User } from "./gen/example";
      `);
      expect(tracker.isProtobufIdentifier("User")).toBe(false);
    });

    it("tracks imports from _pb.js files", () => {
      const tracker = createTracker(`
        import { User } from "./gen/example_pb.js";
      `);
      expect(tracker.isProtobufIdentifier("User")).toBe(true);
    });

    it("tracks imports from _pb.ts files", () => {
      const tracker = createTracker(`
        import { User } from "./gen/example_pb.ts";
      `);
      expect(tracker.isProtobufIdentifier("User")).toBe(true);
    });

    it("handles renamed imports", () => {
      const tracker = createTracker(`
        import { User as MyUser } from "./gen/example_pb";
      `);
      // ローカル名で追跡
      expect(tracker.isProtobufIdentifier("MyUser")).toBe(true);
      expect(tracker.isProtobufIdentifier("User")).toBe(false);
    });
  });

  describe("getSourceFile", () => {
    it("returns the source file path for a tracked identifier", () => {
      const tracker = createTracker(`
        import { User } from "./gen/example_pb";
      `);
      expect(tracker.getSourceFile("User")).toBe("./gen/example_pb");
    });

    it("returns undefined for untracked identifiers", () => {
      const tracker = createTracker(`
        import { User } from "./gen/example_pb";
      `);
      expect(tracker.getSourceFile("Unknown")).toBeUndefined();
    });
  });

  describe("getOriginalName", () => {
    it("returns the original import name for renamed imports", () => {
      const tracker = createTracker(`
        import { User as MyUser } from "./gen/example_pb";
      `);
      expect(tracker.getOriginalName("MyUser")).toBe("User");
    });

    it("returns the same name if not renamed", () => {
      const tracker = createTracker(`
        import { User } from "./gen/example_pb";
      `);
      expect(tracker.getOriginalName("User")).toBe("User");
    });
  });

  describe("isTypeOnlyImport", () => {
    it("returns true for type-only import declarations", () => {
      const tracker = createTracker(`
        import type { User } from "./gen/example_pb";
      `);
      expect(tracker.isTypeOnlyImport("User")).toBe(true);
    });

    it("returns true for inline type specifiers", () => {
      const tracker = createTracker(`
        import { type User, Post } from "./gen/example_pb";
      `);
      expect(tracker.isTypeOnlyImport("User")).toBe(true);
      expect(tracker.isTypeOnlyImport("Post")).toBe(false);
    });

    it("returns false for value imports", () => {
      const tracker = createTracker(`
        import { User } from "./gen/example_pb";
      `);
      expect(tracker.isTypeOnlyImport("User")).toBe(false);
    });
  });
});
