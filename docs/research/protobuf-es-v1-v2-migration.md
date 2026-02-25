# protobuf-es v1 → v2 Migration Research

## Overview

protobuf-es v2 ではクラスベースの API からプレーンオブジェクト + スキーマベースの関数型 API に移行。
メッセージはクラスインスタンスではなくプレーンオブジェクトとなり、操作は全てスタンドアロン関数で行う。

## Breaking Changes

### 1. Constructor → `create()`

v1 ではクラスコンストラクタでメッセージを生成していたが、v2 では `create()` 関数を使用。

```typescript
// v1
import { User } from "./gen/example_pb";
let user = new User({ firstName: "Homer" });

// v2
import { create } from "@bufbuild/protobuf";
import { UserSchema } from "./gen/example_pb";
let user = create(UserSchema, { firstName: "Homer" });
```

引数なしの場合:
```typescript
// v1
let user = new User();

// v2
let user = create(UserSchema);
```

### 2. Static Methods → Standalone Functions

静的メソッドがスタンドアロン関数に変更。第一引数にスキーマを渡す。

```typescript
// v1
import { User } from "./gen/example_pb";
const user = User.fromBinary(bytes);
const user2 = User.fromJson(json);
const user3 = User.fromJsonString(str);

// v2
import { fromBinary, fromJson, fromJsonString } from "@bufbuild/protobuf";
import { UserSchema } from "./gen/example_pb";
const user = fromBinary(UserSchema, bytes);
const user2 = fromJson(UserSchema, json);
const user3 = fromJsonString(UserSchema, str);
```

### 3. Instance Methods → Standalone Functions

インスタンスメソッドもスタンドアロン関数に変更。第一引数にスキーマ、第二引数にメッセージを渡す。

```typescript
// v1
const bytes = user.toBinary();
const json = user.toJson();
const str = user.toJsonString();
const copy = user.clone();
const isEqual = user.equals(other);

// v2
import { toBinary, toJson, toJsonString, clone, equals } from "@bufbuild/protobuf";
import { UserSchema } from "./gen/example_pb";
const bytes = toBinary(UserSchema, user);
const json = toJson(UserSchema, user);
const str = toJsonString(UserSchema, user);
const copy = clone(UserSchema, user);
const isEqual = equals(UserSchema, user, other);
```

### 4. `toPlainMessage()` 除去

v2 ではメッセージが既にプレーンオブジェクトのため不要。

```typescript
// v1
const plain = user.toPlainMessage();

// v2
// user は既にプレーンオブジェクト。呼び出しを削除してレシーバーをそのまま使う。
const plain = user;
```

### 5. `PlainMessage<T>` → `T`

v2 ではメッセージ自体がプレーンオブジェクトのため `PlainMessage` ラッパーは不要。

```typescript
// v1
import { PlainMessage } from "@bufbuild/protobuf";
function processUser(user: PlainMessage<User>) { /* ... */ }

// v2
function processUser(user: User) { /* ... */ }
```

### 6. `PartialMessage<T>` → `MessageInitShape<typeof TSchema>`

```typescript
// v1
import { PartialMessage } from "@bufbuild/protobuf";
function createUser(init: PartialMessage<User>) { /* ... */ }

// v2
import type { MessageInitShape } from "@bufbuild/protobuf";
import { UserSchema } from "./gen/example_pb";
function createUser(init: MessageInitShape<typeof UserSchema>) { /* ... */ }
```

### 7. Well-Known Type Import Path Changes

WKT が `@bufbuild/protobuf` から `@bufbuild/protobuf/wkt` に移動。

```typescript
// v1
import { Timestamp } from "@bufbuild/protobuf";

// v2
import { TimestampSchema } from "@bufbuild/protobuf/wkt";
```

## Well-Known Types Complete List

### Core WKT
| v1 Type | v2 Schema | v2 Import Path |
|---------|-----------|----------------|
| `Any` | `AnySchema` | `@bufbuild/protobuf/wkt` |
| `Duration` | `DurationSchema` | `@bufbuild/protobuf/wkt` |
| `Timestamp` | `TimestampSchema` | `@bufbuild/protobuf/wkt` |
| `Struct` | `StructSchema` | `@bufbuild/protobuf/wkt` |
| `Value` | `ValueSchema` | `@bufbuild/protobuf/wkt` |
| `ListValue` | `ListValueSchema` | `@bufbuild/protobuf/wkt` |
| `Empty` | `EmptySchema` | `@bufbuild/protobuf/wkt` |
| `FieldMask` | `FieldMaskSchema` | `@bufbuild/protobuf/wkt` |
| `NullValue` | (enum) | `@bufbuild/protobuf/wkt` |

### Wrapper Types
| v1 Type | v2 Schema | v2 Import Path |
|---------|-----------|----------------|
| `DoubleValue` | `DoubleValueSchema` | `@bufbuild/protobuf/wkt` |
| `FloatValue` | `FloatValueSchema` | `@bufbuild/protobuf/wkt` |
| `Int64Value` | `Int64ValueSchema` | `@bufbuild/protobuf/wkt` |
| `UInt64Value` | `UInt64ValueSchema` | `@bufbuild/protobuf/wkt` |
| `Int32Value` | `Int32ValueSchema` | `@bufbuild/protobuf/wkt` |
| `UInt32Value` | `UInt32ValueSchema` | `@bufbuild/protobuf/wkt` |
| `BoolValue` | `BoolValueSchema` | `@bufbuild/protobuf/wkt` |
| `StringValue` | `StringValueSchema` | `@bufbuild/protobuf/wkt` |
| `BytesValue` | `BytesValueSchema` | `@bufbuild/protobuf/wkt` |

### Other Types
| v1 Type | v2 Schema | v2 Import Path |
|---------|-----------|----------------|
| `Api` | `ApiSchema` | `@bufbuild/protobuf/wkt` |
| `Method` | `MethodSchema` | `@bufbuild/protobuf/wkt` |
| `Mixin` | `MixinSchema` | `@bufbuild/protobuf/wkt` |
| `Type` | `TypeSchema` | `@bufbuild/protobuf/wkt` |
| `Field` | `FieldSchema` | `@bufbuild/protobuf/wkt` |
| `Enum` | `EnumSchema` | `@bufbuild/protobuf/wkt` |
| `EnumValue` | `EnumValueSchema` | `@bufbuild/protobuf/wkt` |
| `Option` | `OptionSchema` | `@bufbuild/protobuf/wkt` |
| `SourceContext` | `SourceContextSchema` | `@bufbuild/protobuf/wkt` |

## Generated Code Changes

- v2 ではクラスではなくスキーマオブジェクト (`GenMessage`) が生成される
- 型は interface として生成される (`$typeName` プロパティを含む)
- スキーマ名は型名 + `Schema` サフィックス (e.g., `User` → `UserSchema`)

## Other Changes

- `import_extension` のデフォルトが `none` に変更
- `ts_nocheck` のデフォルトが off に変更
- `google.protobuf.Struct` フィールドは `JsonObject` として生成
- Proto2 フィールドのデフォルト値サポート
- `toJSON` メソッドの除去 (`toJson()` 関数を使う)
