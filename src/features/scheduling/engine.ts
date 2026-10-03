import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import {
  appointmentDraftSchema,
  appointmentStatusSchema,
  rescheduleDraftSchema,
  rescheduleSlotsInputSchema,
  schedulingResultSchema,
  slotSchema,
  slotsInputSchema,
  type AppointmentDraft,
  type RescheduleDraft,
  type RescheduleSlotsInput,
  type SlotsInput,
} from "./model";

function operationError(message: string, detail?: string) {
  return new Error(detail ? `${message} (${detail})` : message);
}

export async function getRequiredResources(clinicId: string, serviceId: string) {
  const { client } = await requireClinic(clinicId, "appointments.read");
  const sid = z.uuid().parse(serviceId);
  const { data, error } = await client.rpc("get_required_resources", {
    cid: clinicId,
    sid,
  });
  if (error)
    throw operationError("Cerințele serviciului nu au putut fi încărcate.", error.code);
  return data;
}

export async function findAvailableResources(
  clinicId: string,
  draft: AppointmentDraft,
  excludedAppointment?: string,
) {
  const { client } = await requireClinic(clinicId, "appointments.read");
  const input = appointmentDraftSchema.parse(draft);
  const { data, error } = await client.rpc("find_available_resources", {
    cid: clinicId,
    sid: input.service_id,
    starts: input.start_at,
    doctor_id: input.doctor_id ?? null,
    room_id: input.room_id ?? null,
    equipment_ids: input.equipment_ids,
    excluded_appointment: excludedAppointment ?? null,
  });
  if (error)
    throw operationError("Resursele disponibile nu au putut fi calculate.", error.code);
  return schedulingResultSchema.parse(data);
}

export const assignResources = findAvailableResources;

export async function validateAppointment(
  clinicId: string,
  draft: AppointmentDraft,
  excludedAppointment?: string,
) {
  const { client } = await requireClinic(clinicId, "appointments.read");
  const input = appointmentDraftSchema.parse(draft);
  const { data, error } = await client.rpc("validate_appointment", {
    cid: clinicId,
    payload: input,
    excluded_appointment: excludedAppointment ?? null,
  });
  if (error)
    throw operationError("Programarea nu a putut fi validată.", error.code);
  return schedulingResultSchema.parse(data);
}

export async function findConflicts(
  clinicId: string,
  draft: AppointmentDraft,
  excludedAppointment?: string,
) {
  const { client } = await requireClinic(clinicId, "appointments.read");
  const input = appointmentDraftSchema.parse(draft);
  const { data, error } = await client.rpc("find_conflicts", {
    cid: clinicId,
    payload: input,
    excluded_appointment: excludedAppointment ?? null,
  });
  if (error)
    throw operationError("Conflictele nu au putut fi verificate.", error.code);
  return z.array(z.object({ code: z.string() }).passthrough()).parse(data);
}

export async function createAppointment(
  clinicId: string,
  draft: AppointmentDraft,
) {
  const { client } = await requireClinic(clinicId, "appointments.manage");
  const payload = appointmentDraftSchema.parse(draft);
  const { data, error } = await client.rpc("create_appointment", {
    cid: clinicId,
    payload,
  });
  if (error)
    throw operationError("Programarea nu a putut fi creată.", error.code);
  return schedulingResultSchema.parse(data);
}

export async function rescheduleAppointment(
  clinicId: string,
  appointmentId: string,
  draft: RescheduleDraft,
) {
  const { client } = await requireClinic(clinicId, "appointments.manage");
  const aid = z.uuid().parse(appointmentId);
  const { expected_updated_at, ...payload } = rescheduleDraftSchema.parse(draft);
  const { data, error } = await client.rpc("reschedule_appointment", {
    cid: clinicId,
    aid,
    payload,
    expected_updated_at,
  });
  if (error)
    throw operationError("Programarea nu a putut fi mutată.", error.code);
  return schedulingResultSchema.parse(data);
}

export async function cancelAppointment(
  clinicId: string,
  appointmentId: string,
  reason: string,
  expectedUpdatedAt: string,
) {
  const { client } = await requireClinic(clinicId, "appointments.manage");
  const { data, error } = await client.rpc("cancel_appointment", {
    cid: clinicId,
    aid: z.uuid().parse(appointmentId),
    reason: z.string().trim().max(1000).parse(reason),
    expected_updated_at: z.iso.datetime({ offset: true }).parse(expectedUpdatedAt),
  });
  if (error)
    throw operationError("Programarea nu a putut fi anulată.", error.code);
  return schedulingResultSchema.parse(data);
}

export async function changeAppointmentStatus(
  clinicId: string,
  appointmentId: string,
  status: string,
  expectedUpdatedAt: string,
) {
  const { client } = await requireClinic(clinicId, "appointments.manage");
  const { data, error } = await client.rpc("set_appointment_status", {
    cid: clinicId,
    aid: z.uuid().parse(appointmentId),
    next_status: appointmentStatusSchema.parse(status),
    expected_updated_at: z.iso.datetime({ offset: true }).parse(expectedUpdatedAt),
  });
  if (error)
    throw operationError("Starea programării nu a putut fi schimbată.", error.code);
  return data;
}

export async function getAvailableSlots(clinicId: string, options: SlotsInput) {
  const { client } = await requireClinic(clinicId, "appointments.read");
  const input = slotsInputSchema.parse(options);
  const { data, error } = await client.rpc("get_available_slots", {
    cid: clinicId,
    sid: input.service_id,
    window_start: input.window_start,
    window_end: input.window_end,
    doctor_id: input.doctor_id ?? null,
    step_minutes: input.step_minutes,
  });
  if (error)
    throw operationError("Sloturile disponibile nu au putut fi calculate.", error.code);
  return z.array(slotSchema).parse(data);
}

export async function getRescheduleSlots(
  clinicId: string,
  appointmentId: string,
  options: RescheduleSlotsInput,
) {
  const { client } = await requireClinic(clinicId, "appointments.read");
  const input = rescheduleSlotsInputSchema.parse(options);
  const { data, error } = await client.rpc("get_reschedule_slots", {
    cid: clinicId,
    aid: z.uuid().parse(appointmentId),
    window_start: input.window_start,
    window_end: input.window_end,
    doctor_id: input.doctor_id ?? null,
    step_minutes: input.step_minutes,
  });
  if (error)
    throw operationError("Intervalele pentru mutare nu au putut fi calculate.", error.code);
  return z.array(slotSchema).parse(data);
}

export async function resizeAppointment(
  clinicId: string,
  appointmentId: string,
  durationMinutes: number,
  expectedUpdatedAt: string,
) {
  const { client } = await requireClinic(clinicId, "appointments.manage");
  const { data, error } = await client.rpc("resize_appointment", {
    cid: clinicId,
    aid: z.uuid().parse(appointmentId),
    new_duration_minutes: z.number().int().min(5).max(1440).parse(durationMinutes),
    expected_updated_at: z.iso.datetime({ offset: true }).parse(expectedUpdatedAt),
  });
  if (error) throw operationError("Durata programării nu a putut fi modificată.", error.code);
  return z.object({ ok: z.boolean(), updated_at: z.string().optional() }).passthrough().parse(data);
}
