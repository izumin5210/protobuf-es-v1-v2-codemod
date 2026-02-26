import { DateMessage, DateMessageSchema } from "@example/gen/google/type/date_pb";

import { isMessage } from "@bufbuild/protobuf";

function isDate(value: unknown): value is DateMessage {
  return isMessage(value, DateMessageSchema);
}
