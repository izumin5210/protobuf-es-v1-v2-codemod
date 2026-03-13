import { getLogger } from "~libs/logger";

class MyClass {}

function isMyClass(value: unknown): value is MyClass {
  return value instanceof MyClass;
}

const logger = getLogger();
