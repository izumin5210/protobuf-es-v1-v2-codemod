import type { Timestamp } from "@bufbuild/protobuf/wkt";

function getTimestamp(): Timestamp {
  return { seconds: BigInt(0), nanos: 0, $typeName: "google.protobuf.Timestamp" as const };
}
