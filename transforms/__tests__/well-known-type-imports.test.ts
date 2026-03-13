import { describe, expect, it } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../well-known-type-imports.js";

describe("well-known-type-imports", () => {
  it.each([
    "basic",
    "mixed",
    "multiple-wkt",
    "no-wkt",
    "type-import",
  ])("transforms %s correctly", (fixture) => {
    const { actual, expected } = applyFixtureTransform(
      transform,
      import.meta.dirname,
      `well-known-type-imports/${fixture}`,
    );
    expect(actual).toBe(expected);
  });
});
