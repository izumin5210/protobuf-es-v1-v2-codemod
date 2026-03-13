import type { MessageInitShape } from "@bufbuild/protobuf";
import { User, UserSchema } from "./gen/example_pb";

function createUser(init: MessageInitShape<typeof UserSchema>) {
  console.log(init);
}
