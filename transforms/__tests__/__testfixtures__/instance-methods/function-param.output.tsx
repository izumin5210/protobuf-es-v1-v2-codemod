import { toJsonString } from "@bufbuild/protobuf";
import { User, UserSchema } from "./gen/example_pb";

function processUser(user: User) {
  return toJsonString(UserSchema, user);
}
