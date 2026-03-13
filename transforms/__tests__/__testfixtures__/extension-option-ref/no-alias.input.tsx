import { getOption, hasOption } from "@bufbuild/protobuf";
import { tagSchema } from "@example/gen/example/v1/example_pb";

if (hasOption(desc, tagSchema)) {
  const { value } = getOption(desc, tagSchema);
}
