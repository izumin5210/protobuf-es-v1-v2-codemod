import { getOption, hasOption } from "@bufbuild/protobuf";
import { tag as tagExt } from "@example/gen/example/v1/example_pb";

if (hasOption(desc, tagExt)) {
  const { value } = getOption(desc, tagExt);
}
