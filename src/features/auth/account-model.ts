import { z } from "zod";
export const passwordSchema = z.string().min(12, "Folosiți cel puțin 12 caractere.").max(128);
const accountFields = z.object({ full_name: z.string().trim().min(2).max(100), email: z.email().max(254).transform((v) => v.trim().toLowerCase()), password: passwordSchema, password_confirmation: z.string() });
export const registerSchema = accountFields.refine((v) => v.password === v.password_confirmation, { message: "Parolele nu coincid.", path: ["password_confirmation"] });
export const resetSchema = accountFields.pick({ password: true, password_confirmation: true }).refine((v) => v.password === v.password_confirmation, { message: "Parolele nu coincid." });
export function safeAuthDestination(value: string | null) {
  if (value === "/" || value === "/portal" || value === "/reset-password") return value;
  if (value && /^\/invitations\/[A-Za-z0-9_-]{43}$/.test(value)) return value;
  return "/";
}
