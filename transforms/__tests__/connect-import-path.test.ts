import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../connect-import-path.js";

describe("connect-import-path", () => {
  it.each([
    "basic",
    "no-connect",
  ])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `connect-import-path/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
