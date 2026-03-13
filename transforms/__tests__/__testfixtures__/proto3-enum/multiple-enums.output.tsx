import { Status, Category, StatusSchema, CategorySchema } from "./gen/example_pb";

const statusName = StatusSchema.values.find(v => v.number === p)?.name;
const catName = CategorySchema.values.find(v => v.number === r)?.name;
