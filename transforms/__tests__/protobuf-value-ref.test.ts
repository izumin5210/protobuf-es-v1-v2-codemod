import { describe, it, expect } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../protobuf-value-ref.js";

describe("protobuf-value-ref", () => {
  it.each([
    "basic",
    "no-protobuf",
    "call-argument",
    "type-only-import",
    "service-descriptor",
    "aliased-service",
  ])(
    "transforms %s correctly",
    (fixture) => {
      const { actual, expected } = applyFixtureTransform(
        transform,
        import.meta.dirname,
        `protobuf-value-ref/${fixture}`,
      );
      expect(actual).toBe(expected);
    },
  );
});
