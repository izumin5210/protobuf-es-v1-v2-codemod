import type { MessageInitShape } from "@bufbuild/protobuf";
import type { User } from "./gen/example_pb";
import { UserSchema } from "./gen/example_pb";

function processUser(user: User) {
  console.log(user);
}

function createUser(init: MessageInitShape<typeof UserSchema>) {
  console.log(init);
}
