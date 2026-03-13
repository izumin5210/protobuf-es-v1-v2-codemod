import { Status, StatusSchema } from "./gen/example_pb";

const name = StatusSchema.values.find(v => v.number === 1)?.name;
