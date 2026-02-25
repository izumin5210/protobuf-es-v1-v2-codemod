import { clone, equals, toBinary, toJson, toJsonString } from "@bufbuild/protobuf";
import { User, UserSchema } from "./gen/example_pb";

const user: User = new User({ name: "Homer" });
const bytes = toBinary(UserSchema, user);
const json = toJson(UserSchema, user);
const str = toJsonString(UserSchema, user);
const copy = clone(UserSchema, user);
const isEqual = equals(UserSchema, user, other);
