import type { User } from "./gen/example_pb";

const user = User.fromBinary(new Uint8Array());
