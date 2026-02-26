import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../instanceof-message.js";

describe("instanceof-message", () => {
  it.each([
    "basic",
    "no-protobuf",
    "multiple",
  ])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `instanceof-message/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
