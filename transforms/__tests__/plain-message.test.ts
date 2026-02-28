import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../plain-message.js";

describe("plain-message", () => {
  it.each(["plain-message", "partial-message", "mixed", "no-transform", "partial-message-no-schema-import", "partial-message-type-only-import"])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `plain-message/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
