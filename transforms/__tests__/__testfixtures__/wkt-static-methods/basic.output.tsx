import { timestampFromDate, timestampNow } from "@bufbuild/protobuf/wkt";
import { PostResponse } from "@example/gen/example/v1/example_pb";

const ts = timestampFromDate(new Date());
const now = timestampNow();
