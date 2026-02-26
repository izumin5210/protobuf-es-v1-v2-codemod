import { DateMessage } from "@example/gen/google/type/date_pb";
import { Timestamp } from "@example/gen/google/protobuf/timestamp_pb";

function check(value: unknown) {
  if (value instanceof DateMessage) {
    return "date";
  }
  if (value instanceof Timestamp) {
    return "timestamp";
  }
  return "unknown";
}
