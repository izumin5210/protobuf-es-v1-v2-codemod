import { User } from "./gen/example_pb";

const user: User = new User({ name: "Homer" });
const bytes = user.toBinary();
const json = user.toJson();
const str = user.toJsonString();
const copy = user.clone();
const isEqual = user.equals(other);
