import { PlainMessage } from "@bufbuild/protobuf";
import type { User } from "./gen/example_pb";

function processUser(user: PlainMessage<User>) {
  console.log(user);
}
