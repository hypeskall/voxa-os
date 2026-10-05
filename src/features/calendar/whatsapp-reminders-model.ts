import { z } from "zod";

export const whatsappRemindersSchema = z.array(z.object({
  id: z.uuid(), patient_id: z.uuid(), start_at: z.string(), end_at: z.string(), status: z.string(),
  patient_name: z.string(), patient_phone: z.string(), service_name: z.string(), doctor_name: z.string().nullable(),
}));

export type WhatsappReminder = z.infer<typeof whatsappRemindersSchema>[number];
