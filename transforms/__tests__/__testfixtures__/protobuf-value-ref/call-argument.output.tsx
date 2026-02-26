import { CustomOption, CustomOptionSchema } from "@example/gen/example/v1/example_pb";
import { getOption } from "@bufbuild/protobuf";

const opt = getOption(field, CustomOptionSchema);
