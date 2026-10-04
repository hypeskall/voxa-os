import { z } from "zod";

export const mfaCodeSchema = z.string().regex(/^\d{6}$/);
export const mfaFactorSchema = z.uuid();

export function safeMfaDestination(value: string | null) {
  if (value && ["/dashboard", "/account/security", "/reset-password", "/portal"].includes(value)) return value;
  if (value && /^\/invitations\/[A-Za-z0-9_-]{43}$/.test(value)) return value;
  if (value && /^\/clinics\/[a-f0-9-]{36}$/.test(value)) return value;
  return "/dashboard";
}
