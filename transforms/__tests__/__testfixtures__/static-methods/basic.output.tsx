import { fromBinary, fromJson, fromJsonString } from "@bufbuild/protobuf";
import { User, UserSchema } from "./gen/example_pb";

const bytes = new Uint8Array();
const user = fromBinary(UserSchema, bytes);
const user2 = fromJson(UserSchema, { name: "Homer" });
const user3 = fromJsonString(UserSchema, '{"name": "Homer"}');
