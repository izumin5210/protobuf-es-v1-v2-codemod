import { describe, expect, it } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../wkt-static-methods.js";

describe("wkt-static-methods", () => {
  it.each([
    "basic",
    "no-wkt",
    "timestamp-date",
  ])("transforms %s correctly", (fixture) => {
    const { actual, expected } = applyFixtureTransform(
      transform,
      import.meta.dirname,
      `wkt-static-methods/${fixture}`,
    );
    expect(actual).toBe(expected);
  });
});
