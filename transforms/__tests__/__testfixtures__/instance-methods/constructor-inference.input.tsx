import { User } from "./gen/example_pb";

const user = new User({ name: "Homer" });
const bytes = user.toBinary();
