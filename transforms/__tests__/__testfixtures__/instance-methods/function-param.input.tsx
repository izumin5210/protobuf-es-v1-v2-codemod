import { User } from "./gen/example_pb";

function processUser(user: User) {
  return user.toJsonString();
}
