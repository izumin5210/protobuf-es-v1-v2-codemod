import { getExtension } from "@bufbuild/protobuf";

const { metadata } = getExtension(item.proto.options, tagExt);
const { value } = getExtension(enumValue.proto.options, tagExt);
