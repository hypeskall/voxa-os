import { describe, it, expect } from "vitest";
import { authCallbackInput } from "../src/features/auth/callback-model";
import { compareSchema } from "../scripts/staging-schema.mjs";
import { assertDeploymentTarget } from "../src/lib/deployment-target";
describe("hosted auth callback and schema verification", () => {
  it("rejects production and mismatched references in staging builds and server clients", () => {
    expect(() => assertDeploymentTarget("staging", "fibcbsdattoqiyizzeda", "https://fibcbsdattoqiyizzeda.supabase.co", "https://staging.example.ro")).toThrow();
    expect(() => assertDeploymentTarget("staging", "abcdefghijklmnopqrst", "https://wrong.supabase.co", "https://staging.example.ro")).toThrow();
    expect(() => assertDeploymentTarget("staging", "abcdefghijklmnopqrst", "https://abcdefghijklmnopqrst.supabase.co", "https://voxa-os.vercel.app")).toThrow();
    expect(() => assertDeploymentTarget("staging", "abcdefghijklmnopqrst", "https://abcdefghijklmnopqrst.supabase.co", "https://staging.example.ro")).not.toThrow();
  });
  it("supports PKCE while rejecting unrecognized destinations", () => {
    expect(authCallbackInput(new URLSearchParams("code=valid&next=https://evil.test"))).toEqual({ kind: "pkce", code: "valid", next: "/" });
  });
  it("uses a recovery OTP only for password recovery", () => {
    expect(authCallbackInput(new URLSearchParams({ token_hash: "a".repeat(64), type: "recovery", next: "/portal" }))).toMatchObject({ kind: "email", type: "recovery", next: "/reset-password" });
  });
  it("keeps invitation context for cross-device email confirmation", () => {
    const next = `/invitations/${"b".repeat(43)}`;
    expect(authCallbackInput(new URLSearchParams({ token_hash: "a".repeat(64), type: "signup", next }))).toMatchObject({ kind: "email", next });
  });
  it("rejects malformed email tokens, unsupported types and ambiguous fallback", () => {
    const inputs: Record<string, string>[] = [{ token_hash: "short", type: "signup" }, { token_hash: "a".repeat(64), type: "email_change" }, { token_hash: "<script>".repeat(10), type: "email" }, { token_hash: "", type: "signup", code: "otherwise-valid" }];
    for (const input of inputs)
      expect(authCallbackInput(new URLSearchParams(input)).kind).toBe("invalid");
  });
  it("detects removed tenant policies and newly public security-definer functions", () => {
    const expected = [{ kind: "policy", key: "public.patients.read_rows", definition: { cmd: "SELECT" } }];
    expect(compareSchema(expected, [])).toContain("Missing policy:public.patients.read_rows");
    expect(compareSchema([], [{ kind: "function", key: "public.leak()", definition: { security_definer: true, anon_execute: true } }])).toHaveLength(1);
    expect(compareSchema([], [{ kind: "table", key: "public.patients", definition: { rls: false } }])).toHaveLength(1);
  });
});
