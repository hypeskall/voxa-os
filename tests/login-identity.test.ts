import { describe, expect, it } from "vitest";
import { loginSchema } from "../src/lib/validation";
import { loginIdentityEmail } from "../src/features/auth/login-identity";

describe("staff username login", () => {
  it("normalizes usernames without touching passwords", () => {
    const value = loginSchema.parse({ identifier: " Laura ", password: " password " });
    expect(value).toEqual({ identifier: "laura", password: " password " });
    expect(loginIdentityEmail(value.identifier)).toBe("laura@users.voxa.invalid");
  });
  it("preserves existing email accounts", () => {
    const value = loginSchema.parse({ identifier: " OWNER@VOXA.TEST ", password: "password" });
    expect(loginIdentityEmail(value.identifier)).toBe("owner@voxa.test");
  });
  it.each(["", "ab", "laura laura", "laura:password", "../laura", "a".repeat(33)])("rejects invalid usernames: %s", (identifier) => {
    expect(loginSchema.safeParse({ identifier, password: "password" }).success).toBe(false);
  });
});
