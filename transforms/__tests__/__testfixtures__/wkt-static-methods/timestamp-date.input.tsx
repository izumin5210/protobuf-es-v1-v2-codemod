import { Timestamp } from "@bufbuild/protobuf/wkt";

function toTimestamp(date: Date) {
  return Timestamp.fromDate(date);
}
