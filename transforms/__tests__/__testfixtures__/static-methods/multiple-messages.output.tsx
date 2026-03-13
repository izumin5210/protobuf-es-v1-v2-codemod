import { fromBinary, fromJsonString } from "@bufbuild/protobuf";
import { User, Post, UserSchema, PostSchema } from "./gen/example_pb";

const user = fromBinary(UserSchema, new Uint8Array());
const post = fromJsonString(PostSchema, '{"title": "Hello"}');
