import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 推奨実行順序で並べた transform 名 */
export const TRANSFORM_NAMES = [
  // connect-es v2 migration
  "connect-import-path",
  "connect-client-types",
  // protobuf-es v2 migration
  "message-constructor",
  "static-methods",
  "instance-methods",
  "to-plain-message",
  "plain-message",
  "well-known-type-imports",
  "wkt-static-methods",
  "instanceof-message",
  "protobuf-value-ref",
  "proto3-enum",
  "extension-option-ref",
] as const;

export type TransformName = (typeof TRANSFORM_NAMES)[number];

const VALID_TRANSFORMS = new Set<string>([...TRANSFORM_NAMES, "all"]);

export interface CliArgs {
  transform: TransformName | "all";
  paths: string[];
  dry: boolean;
  print: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  let transform: string | undefined;
  let dry = false;
  let print = false;
  const paths: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--transform=")) {
      transform = arg.slice("--transform=".length);
    } else if (arg === "--dry") {
      dry = true;
    } else if (arg === "--print") {
      print = true;
    } else if (!arg.startsWith("--")) {
      paths.push(arg);
    }
  }

  if (!transform) {
    throw new Error(
      "Missing --transform option. Usage: protobuf-es-codemod --transform=<name|all> <path>",
    );
  }

  if (!VALID_TRANSFORMS.has(transform)) {
    throw new Error(
      `Unknown transform "${transform}". Valid transforms: ${[...VALID_TRANSFORMS].join(", ")}`,
    );
  }

  if (paths.length === 0) {
    throw new Error(
      "No path provided. Usage: protobuf-es-codemod --transform=<name|all> <path>",
    );
  }

  return { transform: transform as CliArgs["transform"], paths, dry, print };
}

export function resolveTransforms(transform: TransformName | "all"): string[] {
  const names = transform === "all" ? [...TRANSFORM_NAMES] : [transform];
  return names.map((name) =>
    path.resolve(__dirname, "..", "transforms", `${name}.ts`),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const transforms = resolveTransforms(args.transform);

  // jscodeshift の Runner は CJS なので動的 import
  const { run } = await import("jscodeshift/src/Runner.js");

  for (const transformPath of transforms) {
    const name = path.basename(transformPath, ".ts");
    console.log(`\nRunning transform: ${name}`);

    await run(transformPath, args.paths, {
      dry: args.dry,
      print: args.print,
      verbose: 0,
      babel: false,
      extensions: "ts,tsx,js,jsx",
      parser: "tsx",
      ignorePattern: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    });
  }
}

// CLI として直接実行された場合
const isMain =
  process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    process.argv[1].endsWith("/cli.ts"));

if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
