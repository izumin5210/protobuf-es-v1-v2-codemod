import { create } from "@bufbuild/protobuf";
import { User, UserSchema } from "./gen/example_pb";

const user = create(UserSchema, { name: "Homer" });
const emptyUser = create(UserSchema);
