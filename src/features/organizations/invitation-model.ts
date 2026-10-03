import { z } from "zod";
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const invitationSchema = z.object({ email: z.email().max(254), role: z.enum(["ADMIN", "RECEPTION", "DOCTOR"]) });
