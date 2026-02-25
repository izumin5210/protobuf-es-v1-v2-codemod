import { User } from "./gen/example_pb";

function process(msg: unknown) {
  return msg.toBinary();
}
