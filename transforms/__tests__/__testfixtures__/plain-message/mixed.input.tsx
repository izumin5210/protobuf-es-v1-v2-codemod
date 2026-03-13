import { PlainMessage, PartialMessage } from "@bufbuild/protobuf";
import type { User } from "./gen/example_pb";
import { UserSchema } from "./gen/example_pb";

function processUser(user: PlainMessage<User>) {
  console.log(user);
}

function createUser(init: PartialMessage<User>) {
  console.log(init);
}
