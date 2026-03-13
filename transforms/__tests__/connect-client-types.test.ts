import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../connect-client-types.js";

describe("connect-client-types", () => {
  it.each([
    "basic",
    "no-connect",
  ])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `connect-client-types/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
