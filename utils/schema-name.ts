const SCHEMA_SUFFIX = "Schema";

export function toSchemaName(messageName: string): string {
  if (
    messageName.endsWith(SCHEMA_SUFFIX) &&
    messageName.length > SCHEMA_SUFFIX.length
  ) {
    return messageName;
  }
  return messageName + SCHEMA_SUFFIX;
}

export function isSchemaName(name: string): boolean {
  return name.endsWith(SCHEMA_SUFFIX) && name.length > SCHEMA_SUFFIX.length;
}
