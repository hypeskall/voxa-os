import { z } from "zod";

export const appointmentStatuses = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export const appointmentSources = [
  "RECEPTION",
  "WEBSITE",
  "PATIENT_PORTAL",
  "API",
  "VOICE_AGENT",
] as const;
export const appointmentStatusSchema = z.enum(appointmentStatuses);
export const appointmentSourceSchema = z.enum(appointmentSources);

const optionalId = z.uuid().nullable().optional();
const appointmentDraftBaseSchema = z.object({
  patient_id: z.uuid(),
  service_id: z.uuid(),
  start_at: z.iso.datetime({ offset: true }),
  doctor_id: optionalId,
  room_id: optionalId,
  equipment_ids: z.array(z.uuid()).max(100).default([]),
  source: appointmentSourceSchema.default("RECEPTION"),
  status: z.enum(["PENDING", "CONFIRMED"]).default("PENDING"),
  notes: z.string().trim().max(5000).default(""),
  override_duplicate: z.boolean().default(false),
  override_reason: z.string().trim().max(1000).default(""),
});
export const appointmentDraftSchema = appointmentDraftBaseSchema.refine(
  (value) => !value.override_duplicate || value.override_reason.length >= 3,
  { path: ["override_reason"], message: "Motivul confirmării este obligatoriu." },
);
export type AppointmentDraft = z.input<typeof appointmentDraftSchema>;

export const rescheduleDraftSchema = appointmentDraftBaseSchema
  .omit({ patient_id: true, service_id: true, source: true, status: true })
  .extend({ expected_updated_at: z.iso.datetime({ offset: true }) });
export type RescheduleDraft = z.input<typeof rescheduleDraftSchema>;

export const conflictSchema = z
  .object({
    code: z.string(),
    resource_kind: z.string().optional(),
    resource_id: z.uuid().optional(),
    requirement_group: z.uuid().optional(),
  })
  .passthrough();
export const warningSchema = z
  .object({
    code: z.string(),
    appointment_id: z.uuid().optional(),
    start_at: z.string().optional(),
  })
  .passthrough();
const equipmentAssignmentSchema = z.object({
  id: z.uuid(),
  capacity_units: z.number().int().positive(),
  requirement_group: z.uuid(),
});
export const assignmentSchema = z.object({
  doctor_id: z.uuid().nullable(),
  room_id: z.uuid().nullable(),
  equipment: z.array(equipmentAssignmentSchema),
  start_at: z.string(),
  end_at: z.string(),
  occupied_start_at: z.string(),
  occupied_end_at: z.string(),
  duration_minutes: z.number().int().positive(),
  buffer_before: z.number().int().nonnegative(),
  buffer_after: z.number().int().nonnegative(),
});
export const schedulingResultSchema = z.object({
  ok: z.boolean(),
  appointment_id: z.uuid().optional(),
  updated_at: z.string().optional(),
  assignment: assignmentSchema.optional(),
  conflicts: z.array(conflictSchema).default([]),
  warnings: z.array(warningSchema).default([]),
  requires_override: z.boolean().optional(),
});
export type SchedulingResult = z.infer<typeof schedulingResultSchema>;

export const slotsInputSchema = z
  .object({
    service_id: z.uuid(),
    window_start: z.iso.datetime({ offset: true }),
    window_end: z.iso.datetime({ offset: true }),
    doctor_id: optionalId,
    step_minutes: z.number().int().min(5).max(120).default(15),
  })
  .refine(
    (value) => Date.parse(value.window_end) > Date.parse(value.window_start),
    "Intervalul pentru sloturi este invalid.",
  )
  .refine(
    (value) =>
      Date.parse(value.window_end) - Date.parse(value.window_start) <=
      31 * 24 * 60 * 60 * 1000,
    "Căutarea este limitată la 31 de zile.",
  );
export type SlotsInput = z.input<typeof slotsInputSchema>;
export const slotSchema = z.object({
  start_at: z.string(),
  end_at: z.string(),
  assignment: assignmentSchema,
});
