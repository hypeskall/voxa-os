import { z } from "zod";
import { safeSessionDestination } from "./session-model";

export const mfaCodeSchema = z.string().regex(/^\d{6}$/);
export const mfaFactorSchema = z.uuid();

export function safeMfaDestination(value: string | null) {
  return safeSessionDestination(value);
}
