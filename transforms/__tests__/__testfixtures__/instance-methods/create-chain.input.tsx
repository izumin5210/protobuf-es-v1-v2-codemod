import { create } from "@bufbuild/protobuf";
import { UserSchema } from "./gen/example_pb";

const bytes = create(UserSchema, { name: "Homer" }).toBinary();
const json = create(UserSchema, { name: "Homer" }).toJson();
const str = create(UserSchema, { name: "Homer" }).toJsonString();
