import { proto3 } from "@bufbuild/protobuf";

// Not a protobuf identifier
const name = proto3.getEnumType(SomeLocalEnum).findNumber(1)?.name;
