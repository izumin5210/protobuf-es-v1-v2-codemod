import { describe, expect, it } from "vitest";
import { applyFixtureTransform } from "../../utils/test-utils.js";
import transform from "../extension-option-ref.js";

describe("extension-option-ref", () => {
  it.each([
    "basic",
    "no-extension",
    "no-alias",
  ])("transforms %s correctly", (fixture) => {
    const { actual, expected } = applyFixtureTransform(
      transform,
      import.meta.dirname,
      `extension-option-ref/${fixture}`,
    );
    expect(actual).toBe(expected);
  });
});
