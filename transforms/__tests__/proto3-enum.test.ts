import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../proto3-enum.js";

describe("proto3-enum", () => {
  it.each([
    "basic",
    "multiple-enums",
    "proto3-still-used",
    "no-transform",
  ])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `proto3-enum/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
