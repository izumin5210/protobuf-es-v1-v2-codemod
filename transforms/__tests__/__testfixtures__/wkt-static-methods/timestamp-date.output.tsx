import { timestampFromDate } from "@bufbuild/protobuf/wkt";

function toTimestamp(date: Date) {
  return timestampFromDate(date);
}
