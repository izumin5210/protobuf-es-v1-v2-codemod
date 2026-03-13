import type { Transform } from "jscodeshift";
import { describe, expect, it } from "vitest";
import { applyFixtureTransform, applyTransform } from "../test-utils.js";

const identityTransform: Transform = (fileInfo) => {
  return fileInfo.source;
};

const appendTransform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  // 変換を行わずそのまま返す
  return root.toSource();
};

describe("applyTransform", () => {
  it("returns the source unchanged for identity transform", () => {
    const result = applyTransform(identityTransform, {
      path: "test.ts",
      source: "const x = 1;",
    });
    expect(result).toBe("const x = 1;");
  });

  it("trims whitespace from output", () => {
    const result = applyTransform(identityTransform, {
      path: "test.ts",
      source: "  const x = 1;  \n",
    });
    expect(result).toBe("const x = 1;");
  });

  it("returns empty string for null output", () => {
    const nullTransform: Transform = () => null as unknown as string;
    const result = applyTransform(nullTransform, {
      path: "test.ts",
      source: "const x = 1;",
    });
    expect(result).toBe("");
  });

  it("works with jscodeshift API", () => {
    const result = applyTransform(appendTransform, {
      path: "test.ts",
      source: "const x = 1;",
    });
    expect(result).toBe("const x = 1;");
  });
});

describe("applyFixtureTransform", () => {
  it("reads fixture files and applies transform", () => {
    const { input, expected, actual } = applyFixtureTransform(
      identityTransform,
      import.meta.dirname,
      "identity",
    );
    expect(input).toContain("const x = 1;");
    expect(expected).toBe("const x = 1;");
    expect(actual).toBe(expected);
  });
});
