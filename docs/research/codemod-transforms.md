# Codemod Transforms

## Transform 一覧

### 1. `message-constructor` — コンストラクタ → `create()`

**検出パターン**: `NewExpression` で protobuf メッセージ型のコンストラクタ呼び出し

| v1 | v2 |
|---|---|
| `new User({name: "Homer"})` | `create(UserSchema, {name: "Homer"})` |
| `new User()` | `create(UserSchema)` |

**変換ロジック**:
1. `*_pb` ファイルからインポートされた識別子を追跡
2. `new X(...)` で X が protobuf メッセージの場合に検出
3. `create(XSchema, ...)` に置換
4. `import { create } from "@bufbuild/protobuf"` を追加
5. 元のインポートに `XSchema` を追加 (type import の場合は別の value import として追加)

### 2. `static-methods` — 静的メソッド → スタンドアロン関数

**検出パターン**: `CallExpression` で `MessageType.fromXxx(...)` パターン

| v1 | v2 |
|---|---|
| `User.fromBinary(bytes)` | `fromBinary(UserSchema, bytes)` |
| `User.fromJson(json)` | `fromJson(UserSchema, json)` |
| `User.fromJsonString(str)` | `fromJsonString(UserSchema, str)` |

**変換ロジック**:
1. `X.fromBinary(...)`, `X.fromJson(...)`, `X.fromJsonString(...)` を検出
2. `fromXxx(XSchema, ...)` に置換
3. `import { fromXxx } from "@bufbuild/protobuf"` を追加
4. 元のインポートに `XSchema` を追加

### 3. `instance-methods` — インスタンスメソッド → スタンドアロン関数

**検出パターン**: `CallExpression` で protobuf メッセージのインスタンスメソッド呼び出し

| v1 | v2 |
|---|---|
| `msg.toBinary()` | `toBinary(UserSchema, msg)` |
| `msg.toJson()` | `toJson(UserSchema, msg)` |
| `msg.toJsonString()` | `toJsonString(UserSchema, msg)` |
| `msg.clone()` | `clone(UserSchema, msg)` |
| `msg.equals(other)` | `equals(UserSchema, msg, other)` |

**変換ロジック** (最も複雑):
1. 変数の型を追跡してスキーマ名を特定
   - 型注釈: `const user: User = ...`
   - コンストラクタ推論: `const user = new User(...)` or `create(UserSchema, ...)`
   - 静的メソッド推論: `const user = User.fromBinary(...)`
   - 関数パラメータ型注釈: `function foo(user: User)`
2. `receiver.method(args)` → `method(Schema, receiver, args)`
3. 必要なインポートを追加
4. 型を特定できない場合はスキップ (保守的変換)

### 4. `to-plain-message` — `toPlainMessage()` 除去

**検出パターン**: `CallExpression` で `.toPlainMessage()` メソッド呼び出し

| v1 | v2 |
|---|---|
| `msg.toPlainMessage()` | `msg` |

**変換ロジック**:
1. `.toPlainMessage()` 呼び出しを検出
2. 呼び出し全体をレシーバーオブジェクトに置換

### 5. `plain-message` — `PlainMessage` / `PartialMessage` 型の変換

**検出パターン**: `TSTypeReference` で `PlainMessage<T>` / `PartialMessage<T>`

| v1 | v2 |
|---|---|
| `PlainMessage<User>` | `User` |
| `PartialMessage<User>` | `MessageInitShape<typeof UserSchema>` |

**変換ロジック**:
1. `PlainMessage<T>` を検出し、型引数 `T` に置換
2. `PartialMessage<T>` を検出し、`MessageInitShape<typeof TSchema>` に置換
3. 不要になった `PlainMessage` / `PartialMessage` のインポートを削除
4. 必要に応じて `MessageInitShape` のインポートを追加

### 6. `well-known-type-imports` — WKT インポートパス変更

**検出パターン**: `@bufbuild/protobuf` からの WKT インポート

| v1 | v2 |
|---|---|
| `import { Timestamp } from "@bufbuild/protobuf"` | `import { TimestampSchema } from "@bufbuild/protobuf/wkt"` |

**対象 WKT**:
- Core: `Any`, `Duration`, `Timestamp`, `Struct`, `Value`, `ListValue`, `Empty`, `FieldMask`, `NullValue`
- Wrappers: `DoubleValue`, `FloatValue`, `Int64Value`, `UInt64Value`, `Int32Value`, `UInt32Value`, `BoolValue`, `StringValue`, `BytesValue`
- Other: `Api`, `Method`, `Mixin`, `Type`, `Field`, `Enum`, `EnumValue`, `Option`, `SourceContext`

**変換ロジック**:
1. `@bufbuild/protobuf` からの import 宣言を検出
2. WKT に該当する specifier を分離
3. 非 WKT specifier は `@bufbuild/protobuf` に残す
4. WKT specifier は `@bufbuild/protobuf/wkt` に移動
5. 元の import 宣言が空になった場合は削除

## 共通ユーティリティ

### `protobuf-identifier-tracker`
- `*_pb` ファイルからのインポートを追跡
- 識別子が protobuf メッセージ型かどうかを判定
- 全 transform が依存

### `import-manager`
- インポートの追加・削除・移動を管理
- 重複インポートの防止
- type import と value import の区別
- 全 transform が依存

### `schema-name`
- メッセージ名からスキーマ名を導出: `User` → `UserSchema`
- 全 transform が依存

## 実行順序 (推奨)

1. `message-constructor` — コンストラクタ変換
2. `static-methods` — 静的メソッド変換
3. `instance-methods` — インスタンスメソッド変換 (1,2 の結果を利用可能)
4. `to-plain-message` — toPlainMessage 除去
5. `plain-message` — PlainMessage 型除去
6. `well-known-type-imports` — WKT インポートパス変更 (最後に実行しインポートを整理)
