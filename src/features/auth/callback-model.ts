import { z } from "zod";
import { safeAuthDestination } from "./account-model";

// Email links must never supply arbitrary redirect destinations or OTP types.
export const emailTokenHashSchema = z.string().min(20).max(256).regex(/^[A-Za-z0-9_-]+$/);
const emailLink = z.object({
  token_hash: emailTokenHashSchema,
  type: z.enum(["email", "signup", "recovery", "invite", "magiclink"]),
});
export function authCallbackInput(params: URLSearchParams) {
  const next = safeAuthDestination(params.get("next"));
  if (params.has("token_hash")) {
    const parsed = emailLink.safeParse(Object.fromEntries(params));
    return parsed.success
      ? { kind: "email" as const, ...parsed.data, next: parsed.data.type === "recovery" ? "/reset-password" : next }
      : { kind: "invalid" as const, next };
  }
  const code = params.get("code");
  return code && code.length <= 2048
    ? { kind: "pkce" as const, code, next }
    : { kind: "invalid" as const, next };
}
