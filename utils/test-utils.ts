import fs from "node:fs";
import path from "node:path";
import type { API, FileInfo, Options, Transform } from "jscodeshift";
import jscodeshift from "jscodeshift";

export interface ApplyTransformOptions {
  parser?: "babel" | "babylon" | "ts" | "tsx";
}

/**
 * jscodeshift の transform を適用して結果を返す。
 * jscodeshift/dist/testUtils の applyTransform を ESM + vitest 向けに再実装。
 */
export function applyTransform(
  transform: Transform,
  input: FileInfo,
  options: Options = {},
  transformOptions: ApplyTransformOptions = {},
): string {
  const parser = transformOptions.parser ?? "tsx";
  const j = jscodeshift.withParser(parser);

  const output = transform(
    input,
    {
      jscodeshift: j,
      j,
      stats: () => {},
      report: () => {},
    } satisfies API,
    options,
  );

  if (output instanceof Promise) {
    throw new Error("Async transforms are not supported in test-utils");
  }

  return (output ?? "").trim();
}

/**
 * fixture ファイルのペア (.input.ts / .output.ts) を使って transform の入出力を検証する。
 *
 * テストファイルから以下のように使う:
 * ```ts
 * import { describe, it, expect } from "vitest";
 * import { applyFixtureTransform } from "../../utils/test-utils.js";
 * import transform from "../message-constructor.js";
 *
 * describe("message-constructor", () => {
 *   it("basic", () => {
 *     const { input, expected, actual } = applyFixtureTransform(
 *       transform,
 *       import.meta.dirname,
 *       "message-constructor/basic",
 *     );
 *     expect(actual).toBe(expected);
 *   });
 * });
 * ```
 */
export function applyFixtureTransform(
  transform: Transform,
  testDir: string,
  fixturePrefix: string,
  options: Options = {},
  transformOptions: ApplyTransformOptions = {},
): { input: string; expected: string; actual: string } {
  const fixtureDir = path.join(testDir, "__testfixtures__");
  const ext = extensionForParser(transformOptions.parser ?? "tsx");
  const inputPath = path.join(fixtureDir, `${fixturePrefix}.input.${ext}`);
  const outputPath = path.join(fixtureDir, `${fixturePrefix}.output.${ext}`);

  const input = fs.readFileSync(inputPath, "utf8");
  const expected = fs.readFileSync(outputPath, "utf8").trim();

  const actual = applyTransform(
    transform,
    { path: inputPath, source: input },
    options,
    transformOptions,
  );

  return { input, expected, actual };
}

function extensionForParser(parser: string): string {
  switch (parser) {
    case "ts":
    case "tsx":
      return parser;
    default:
      return "js";
  }
}
