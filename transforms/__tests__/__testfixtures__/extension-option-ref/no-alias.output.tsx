import { getOption, hasOption } from "@bufbuild/protobuf";
import { tag } from "@example/gen/example/v1/example_pb";

if (hasOption(desc, tag)) {
  const { value } = getOption(desc, tag);
}
