import { DateMessage, DateMessageSchema } from "@example/gen/google/type/date_pb";
import { Timestamp, TimestampSchema } from "@example/gen/google/protobuf/timestamp_pb";

import { isMessage } from "@bufbuild/protobuf";

function check(value: unknown) {
  if (isMessage(value, DateMessageSchema)) {
    return "date";
  }
  if (isMessage(value, TimestampSchema)) {
    return "timestamp";
  }
  return "unknown";
}
