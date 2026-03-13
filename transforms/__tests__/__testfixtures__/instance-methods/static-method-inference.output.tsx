import { toBinary } from "@bufbuild/protobuf";
import { User, UserSchema } from "./gen/example_pb";

const user = User.fromBinary(new Uint8Array());
const bytes = toBinary(UserSchema, user);
