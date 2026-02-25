import { describe, it, expect } from "vitest";
import { toSchemaName, isSchemaName } from "../schema-name.js";

describe("toSchemaName", () => {
  it("appends Schema suffix to message name", () => {
    expect(toSchemaName("User")).toBe("UserSchema");
  });

  it("handles multi-word names", () => {
    expect(toSchemaName("GetUserRequest")).toBe("GetUserRequestSchema");
  });

  it("does not double-append Schema suffix", () => {
    expect(toSchemaName("UserSchema")).toBe("UserSchema");
  });
});

describe("isSchemaName", () => {
  it("returns true for names ending with Schema", () => {
    expect(isSchemaName("UserSchema")).toBe(true);
  });

  it("returns false for names not ending with Schema", () => {
    expect(isSchemaName("User")).toBe(false);
  });

  it("returns false for just 'Schema'", () => {
    expect(isSchemaName("Schema")).toBe(false);
  });
});
