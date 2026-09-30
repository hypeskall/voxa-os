import { z } from "zod";

export const confirmationDetailsSchema = z.object({
  clinic_name: z.string(), address: z.string(), phone: z.string(), timezone: z.string(),
  service_name: z.string(), doctor_name: z.string().nullable(), start_at: z.iso.datetime({ offset: true }),
  end_at: z.iso.datetime({ offset: true }), status: z.string(), expires_at: z.iso.datetime({ offset: true }),
  instructions: z.string(), required_documents: z.array(z.string()), exclusion_rules: z.array(z.string()),
});
export type ConfirmationDetails = z.infer<typeof confirmationDetailsSchema>;
