import { Timestamp } from "@bufbuild/protobuf/wkt";
import { PostResponse } from "@example/gen/example/v1/example_pb";

const ts = Timestamp.fromDate(new Date());
const now = Timestamp.now();
