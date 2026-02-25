import { fromBinary } from "@bufbuild/protobuf";
import type { User } from "./gen/example_pb";

import { UserSchema } from "./gen/example_pb";

const user = fromBinary(UserSchema, new Uint8Array());
