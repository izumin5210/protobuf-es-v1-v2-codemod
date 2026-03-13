import { PartialMessage } from "@bufbuild/protobuf";
import type { User } from "./gen/example_pb";

function createUser(init: PartialMessage<User>) {
  console.log(init);
}
