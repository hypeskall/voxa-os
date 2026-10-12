import { z } from "zod";
export const workKind = z.enum(["TASK", "WAITLIST"]);
export const workItem = z.object({
  id: z.uuid(),
  kind: workKind,
  title: z.string(),
  notes: z.string(),
  status: z.string(),
  updated_at: z.string(),
  assigned_to: z.string().nullable(),
  assigned_name: z.string().nullable(),
  due_at: z.string().nullable(),
  patient_id: z.string().nullable(),
  patient_name: z.string().nullable(),
  service_id: z.string().nullable(),
  service_name: z.string().nullable(),
  doctor_id: z.string().nullable(),
  appointment_id: z.string().nullable(),
  preferred_from: z.string().nullable(),
  preferred_to: z.string().nullable(),
  offered_start: z.string().nullable(),
  offer_expires_at: z.string().nullable(),
});
export type WorkItem = z.infer<typeof workItem>;
export const workspaceSchema = z.object({
  items: z.array(workItem),
  staff: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export const workLabels: Record<string, string> = {
  OPEN: "De făcut",
  IN_PROGRESS: "În lucru",
  DONE: "Finalizat",
  CANCELLED: "Anulat",
  OFFERED: "Interval propus",
  BOOKED: "Programat",
};
