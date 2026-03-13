# protobuf-es-v1-v2-codemod

A [jscodeshift](https://github.com/facebook/jscodeshift)-based codemod tool to automate migration from [protobuf-es](https://github.com/bufbuild/protobuf-es) v1 to v2. Also supports [connect-es](https://github.com/connectrpc/connect-es) v2 migration.

## Motivation

protobuf-es v2 introduced a major shift from a class-based API to a plain object + schema-based functional API. This requires numerous changes across existing codebases:

- `new User({...})` → `create(UserSchema, {...})`
- `User.fromBinary(bytes)` → `fromBinary(UserSchema, bytes)`
- `msg.toBinary()` → `toBinary(UserSchema, msg)`
- `PlainMessage<User>` → `User`
- Well-Known Type import path changes
- connect-es import path and type name changes
- ...and more

This codemod automates these mechanical transformations, significantly reducing the effort required for manual migration.

## Installation

```bash
pnpm add -D protobuf-es-v1-v2-codemod
```

## Usage

### Run all transforms at once (recommended)

```bash
pnpm protobuf-es-codemod --transform=all src/
```

### Run a specific transform

```bash
pnpm protobuf-es-codemod --transform=message-constructor src/
```

### Options

| Option | Description |
|--------|-------------|
| `--transform=<name\|all>` | Transform to run. Use `all` to run all transforms in the recommended order |
| `--dry` | Dry run. Preview changes without modifying files |
| `--print` | Print transformed output to stdout |

## Transforms

### connect-es v2 migration

| Transform | Description | Before | After |
|-----------|-------------|--------|-------|
| `connect-import-path` | Rewrite `_connect` import paths to `_pb` | `import { ... } from "./gen/example_connect"` | `import { ... } from "./gen/example_pb"` |
| `connect-client-types` | Rename client types and functions | `PromiseClient` / `createPromiseClient` | `Client` / `createClient` |

### protobuf-es v2 migration

| Transform | Description | Before | After |
|-----------|-------------|--------|-------|
| `message-constructor` | Convert constructors to `create()` | `new User({name: "Homer"})` | `create(UserSchema, {name: "Homer"})` |
| `static-methods` | Convert static methods to standalone functions | `User.fromBinary(bytes)` | `fromBinary(UserSchema, bytes)` |
| `instance-methods` | Convert instance methods to standalone functions | `msg.toBinary()` | `toBinary(UserSchema, msg)` |
| `to-plain-message` | Remove `toPlainMessage()` calls | `msg.toPlainMessage()` | `msg` |
| `plain-message` | Convert `PlainMessage<T>` / `PartialMessage<T>` types | `PlainMessage<User>` | `User` |
| `well-known-type-imports` | Move WKT imports to `@bufbuild/protobuf/wkt` | `import { Timestamp } from "@bufbuild/protobuf"` | `import { TimestampSchema } from "@bufbuild/protobuf/wkt"` |
| `wkt-static-methods` | Convert WKT static methods to standalone functions | `Timestamp.fromDate(date)` | `timestampFromDate(date)` |
| `instanceof-message` | Convert `instanceof` checks to `isMessage()` | `x instanceof User` | `isMessage(x, UserSchema)` |
| `protobuf-value-ref` | Convert message type value references to Schema | Type used as a value | Corresponding Schema descriptor |
| `proto3-enum` | Convert `proto3.getEnumType()` to Schema-based API | `proto3.getEnumType(MyEnum).findNumber(n)` | `MyEnumSchema.values.find(v => v.number === n)` |
| `extension-option-ref` | Convert extension Schema references to GenExtension | Legacy proto extension API | GenExtension object |
| `protoplugin-v2` | Migrate protoplugin imports and API to v2 | `@bufbuild/protoplugin/ecmascript` | `@bufbuild/protoplugin` |

### Execution order

When using `--transform=all`, transforms are automatically executed in the order listed above. This recommended order accounts for dependencies between transforms (e.g., `instance-methods` can leverage results from `message-constructor` and `static-methods`).

## Limitations

- The `instance-methods` transform infers variable types statically. If the type cannot be inferred from type annotations, constructors, or static methods, the call is skipped (conservative by design).
- Generated code (`*_pb` files) is not transformed. Re-generate with `protoc-gen-es` v2 instead.
- Supported file extensions: `.ts`, `.tsx`, `.js`, `.jsx`
- `node_modules/`, `dist/`, and `.next/` are automatically excluded.

## License

[MIT](LICENSE)
