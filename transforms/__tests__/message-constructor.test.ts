import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../message-constructor.js";

describe("message-constructor", () => {
  it.each(["basic", "type-import", "multiple-messages", "no-protobuf"])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `message-constructor/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
