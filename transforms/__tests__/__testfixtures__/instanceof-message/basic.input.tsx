import { DateMessage } from "@example/gen/google/type/date_pb";

function isDate(value: unknown): value is DateMessage {
  return value instanceof DateMessage;
}
