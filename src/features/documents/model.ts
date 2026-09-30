import { z } from "zod";
export const documentSchema = z.object({ id: z.uuid(), title: z.string(), type_name: z.string(), file_name: z.string(), mime_type: z.string(), file_size: z.number(), visible_to_patient: z.boolean(), appointment_id: z.string().nullable(), created_at: z.string() });
export type PatientDocument = z.infer<typeof documentSchema>;
