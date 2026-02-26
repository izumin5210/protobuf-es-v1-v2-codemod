import { create, toBinary, toJson, toJsonString } from "@bufbuild/protobuf";
import { UserSchema } from "./gen/example_pb";

const bytes = toBinary(UserSchema, create(UserSchema, { name: "Homer" }));
const json = toJson(UserSchema, create(UserSchema, { name: "Homer" }));
const str = toJsonString(UserSchema, create(UserSchema, { name: "Homer" }));
