import { describe, expect, it } from "vitest";
import { parseArgs, resolveTransforms, TRANSFORM_NAMES } from "../cli.js";

describe("parseArgs", () => {
  it("parses --transform with a specific name", () => {
    const result = parseArgs(["--transform=message-constructor", "src/"]);
    expect(result.transform).toBe("message-constructor");
    expect(result.paths).toEqual(["src/"]);
    expect(result.dry).toBe(false);
    expect(result.print).toBe(false);
  });

  it("parses --transform=all", () => {
    const result = parseArgs(["--transform=all", "src/"]);
    expect(result.transform).toBe("all");
  });

  it("parses --dry flag", () => {
    const result = parseArgs(["--transform=all", "--dry", "src/"]);
    expect(result.dry).toBe(true);
  });

  it("parses --print flag", () => {
    const result = parseArgs(["--transform=all", "--print", "src/"]);
    expect(result.print).toBe(true);
  });

  it("collects multiple paths", () => {
    const result = parseArgs(["--transform=all", "src/", "lib/"]);
    expect(result.paths).toEqual(["src/", "lib/"]);
  });

  it("throws if --transform is missing", () => {
    expect(() => parseArgs(["src/"])).toThrow("--transform");
  });

  it("throws if no paths are provided", () => {
    expect(() => parseArgs(["--transform=all"])).toThrow("path");
  });

  it("throws for unknown transform name", () => {
    expect(() => parseArgs(["--transform=unknown", "src/"])).toThrow("unknown");
  });
});

describe("resolveTransforms", () => {
  it("returns single transform for a specific name", () => {
    const result = resolveTransforms("message-constructor");
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("message-constructor");
  });

  it("returns all transforms in order for 'all'", () => {
    const result = resolveTransforms("all");
    expect(result).toHaveLength(TRANSFORM_NAMES.length);
  });

  it("returns transforms in the recommended execution order", () => {
    const result = resolveTransforms("all");
    const names = result.map((p) => {
      const match = p.match(/\/([^/]+)\.ts$/);
      return match?.[1];
    });
    expect(names).toEqual([
      "connect-import-path",
      "connect-client-types",
      "message-constructor",
      "static-methods",
      "instance-methods",
      "to-plain-message",
      "plain-message",
      "well-known-type-imports",
      "wkt-static-methods",
      "instanceof-message",
      "protobuf-value-ref",
      "proto3-enum",
      "extension-option-ref",
      "protoplugin-v2",
    ]);
  });
});
