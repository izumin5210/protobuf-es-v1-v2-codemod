import { proto3 } from "@bufbuild/protobuf";
import { Status } from "./gen/example_pb";

const name = proto3.getEnumType(Status).findNumber(1)?.name;
const something = proto3.makeEnum("test", []);
