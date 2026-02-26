import { proto3 } from "@bufbuild/protobuf";
import { Status, Category } from "./gen/example_pb";

const statusName = proto3.getEnumType(Status).findNumber(p)?.name;
const catName = proto3.getEnumType(Category).findNumber(r)?.name;
