import { User } from "./gen/example_pb";

const bytes = new Uint8Array();
const user = User.fromBinary(bytes);
const user2 = User.fromJson({ name: "Homer" });
const user3 = User.fromJsonString('{"name": "Homer"}');
