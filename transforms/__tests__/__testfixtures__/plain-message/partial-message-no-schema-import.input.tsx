import { PartialMessage } from "@bufbuild/protobuf";
import { User } from "./gen/example_pb";

function createUser(init: PartialMessage<User>) {
  console.log(init);
}
