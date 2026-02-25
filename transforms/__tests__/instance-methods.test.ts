import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../instance-methods.js";

describe("instance-methods", () => {
  it.each([
    "type-annotation",
    "constructor-inference",
    "static-method-inference",
    "function-param",
    "unknown-type",
    "multiple-messages",
  ])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `instance-methods/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
