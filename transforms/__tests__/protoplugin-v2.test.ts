import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../protoplugin-v2.js";

describe("protoplugin-v2", () => {
  it.each([
    "import-path",
    "local-name",
    "to-type-only",
    "jsdoc",
    "get-extension",
    "combined",
    "no-protoplugin",
  ])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `protoplugin-v2/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
