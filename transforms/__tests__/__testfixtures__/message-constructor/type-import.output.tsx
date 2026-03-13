import { create } from "@bufbuild/protobuf";
import type { User } from "./gen/example_pb";

import { UserSchema } from "./gen/example_pb";

const user = create(UserSchema, { name: "Homer" });
