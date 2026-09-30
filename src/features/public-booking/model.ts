import { z } from "zod";

export const bookingClinicSchema = z.object({
  slug: z.string(),
  name: z.string(),
  address: z.string(),
  timezone: z.string(),
});
export const publicServiceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  duration_minutes: z.number().int(),
  price: z.number().nullable(),
  doctor_requirement: z.enum(["required", "optional", "none"]),
  category: z.string().nullable(),
  speciality_ids: z.array(z.uuid()),
});
export const publicDoctorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  service_ids: z.array(z.uuid()),
  speciality_ids: z.array(z.uuid()),
});
export const publicCatalogSchema = z.object({
  clinic: bookingClinicSchema,
  specialities: z.array(z.object({ id: z.uuid(), name: z.string() })),
  services: z.array(publicServiceSchema),
  doctors: z.array(publicDoctorSchema),
});
export type PublicCatalog = z.infer<typeof publicCatalogSchema>;
export const publicSlotSchema = z.object({
  start_at: z.string(),
  end_at: z.string(),
  doctor_id: z.uuid().nullable(),
});
export type PublicSlot = z.infer<typeof publicSlotSchema>;

export const publicAvailabilityQuerySchema = z.object({
  clinic: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  service: z.uuid(),
  doctor: z.union([z.uuid(), z.literal("")]).default(""),
  date: z.iso.date(),
});
export const publicBookingSchema = z.object({
  clinic: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  service_id: z.uuid(),
  doctor_id: z.uuid().nullable().optional(),
  start_at: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).default(""),
  email: z.union([z.email().max(254), z.literal("")]).default(""),
  notes: z.string().trim().max(1000).default(""),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
  started_at: z.number().int().positive(),
}).strict().refine((value) => value.phone.replace(/\D/g, "").length >= 7 || value.email.length > 0, {
  path: ["phone"], message: "Completați telefonul sau emailul.",
});

