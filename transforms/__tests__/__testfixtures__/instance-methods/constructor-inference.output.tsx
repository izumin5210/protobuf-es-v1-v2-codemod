import { toBinary } from "@bufbuild/protobuf";
import { User, UserSchema } from "./gen/example_pb";

const user = new User({ name: "Homer" });
const bytes = toBinary(UserSchema, user);
