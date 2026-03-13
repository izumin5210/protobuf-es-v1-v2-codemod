import { describe, expect, it } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../to-plain-message.js";

describe("to-plain-message", () => {
  it.each([
    "basic",
    "chained",
    "no-transform",
  ])("transforms %s correctly", (fixture) => {
    const { actual, expected } = applyFixtureTransform(
      transform,
      import.meta.dirname,
      `to-plain-message/${fixture}`,
    );
    expect(actual).toBe(expected);
  });
});
