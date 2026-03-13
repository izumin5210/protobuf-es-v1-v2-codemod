import { User } from "./gen/example_pb";

function getUser(): User {
  return new User({ name: "Homer" });
}

const plain = getUser().toPlainMessage();
