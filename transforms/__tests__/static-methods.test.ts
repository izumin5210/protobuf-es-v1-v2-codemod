import { describe, expect, it } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../static-methods.js";

describe("static-methods", () => {
  it.each([
    "basic",
    "multiple-messages",
    "type-import",
    "no-protobuf",
  ])("transforms %s correctly", (fixture) => {
    const { actual, expected } = applyFixtureTransform(
      transform,
      import.meta.dirname,
      `static-methods/${fixture}`,
    );
    expect(actual).toBe(expected);
  });
});
