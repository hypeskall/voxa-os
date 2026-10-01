"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinic, requireUser } from "@/features/auth/access";
import {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  getAvailableSlots,
  getRescheduleSlots,
  rescheduleAppointment,
  resizeAppointment,
} from "@/features/scheduling/engine";
import {
  appointmentDraftSchema,
  appointmentStatusSchema,
  slotsInputSchema,
} from "@/features/scheduling/model";
import { calendarFiltersSchema, calendarViewSchema } from "./model";
import { appointmentDetail } from "./data";
import { issueConfirmation } from "@/features/confirmations/service";

type UiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
function failure(error: unknown): UiResult<never> {
  const message = error instanceof Error ? error.message : "Operația nu a putut fi finalizată.";
  if (message.includes("Stale")) return { ok: false, error: "Programarea a fost modificată de alt utilizator. Reîncărcați calendarul." };
  if (message.includes("Access")) return { ok: false, error: "Nu aveți permisiunea necesară." };
  return { ok: false, error: message };
}
function refresh(clinicId: string) {
  revalidatePath(`/clinics/${clinicId}`, "layout");
}

export async function calendarSlotsAction(clinicId: string, raw: unknown): Promise<UiResult> {
  try {
    const input = slotsInputSchema.parse(raw);
    return { ok: true, data: await getAvailableSlots(clinicId, input) };
  } catch (error) {
    return failure(error);
  }
}

export async function calendarRescheduleSlotsAction(
  clinicId: string,
  appointmentId: string,
  raw: unknown,
): Promise<UiResult> {
  try {
    const input = slotsInputSchema.omit({ service_id: true }).parse(raw);
    return { ok: true, data: await getRescheduleSlots(clinicId, appointmentId, input) };
  } catch (error) {
    return failure(error);
  }
}

export async function createAppointmentAction(clinicId: string, raw: unknown): Promise<UiResult> {
  try {
    const result = await createAppointment(clinicId, appointmentDraftSchema.parse(raw));
    if (!result.ok) return { ok: true, data: result };
    if (result.appointment_id) await issueConfirmation(clinicId, result.appointment_id);
    refresh(clinicId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function rescheduleAppointmentAction(clinicId: string, appointmentId: string, raw: unknown): Promise<UiResult> {
  try {
    const input = z.object({
      start_at: z.iso.datetime({ offset: true }),
      doctor_id: z.uuid().nullable().optional(),
      room_id: z.uuid().nullable().optional(),
      equipment_ids: z.array(z.uuid()).default([]),
      expected_updated_at: z.iso.datetime({ offset: true }),
    }).parse(raw);
    const result = await rescheduleAppointment(clinicId, appointmentId, input);
    if (!result.ok) return { ok: false, error: "Intervalul nu mai este disponibil. O altă programare ocupă una dintre resursele necesare." };
    refresh(clinicId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function resizeAppointmentAction(
  clinicId: string,
  appointmentId: string,
  raw: unknown,
): Promise<UiResult> {
  try {
    const input = z.object({
      duration_minutes: z.number().int().min(5).max(1440),
      expected_updated_at: z.iso.datetime({ offset: true }),
    }).parse(raw);
    const result = await resizeAppointment(
      clinicId,
      appointmentId,
      input.duration_minutes,
      input.expected_updated_at,
    );
    if (!result.ok)
      return { ok: false, error: "Noua durată intră în conflict cu programul sau resursele alocate." };
    refresh(clinicId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function appointmentStatusAction(clinicId: string, appointmentId: string, rawStatus: string, expectedUpdatedAt: string): Promise<UiResult> {
  try {
    const status = appointmentStatusSchema.parse(rawStatus);
    if (status === "CANCELLED") throw new Error("Folosiți anularea programării.");
    const result = await changeAppointmentStatus(clinicId, appointmentId, status, expectedUpdatedAt);
    refresh(clinicId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelAppointmentAction(clinicId: string, appointmentId: string, reason: string, expectedUpdatedAt: string): Promise<UiResult> {
  try {
    const result = await cancelAppointment(clinicId, appointmentId, reason, expectedUpdatedAt);
    refresh(clinicId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function updateAppointmentNotesAction(clinicId: string, appointmentId: string, notes: string, expectedUpdatedAt: string): Promise<UiResult> {
  try {
    const { client } = await requireClinic(clinicId, "appointments.manage");
    const { data, error } = await client.rpc("update_appointment_notes", {
      cid: clinicId,
      aid: z.uuid().parse(appointmentId),
      new_notes: z.string().trim().max(5000).parse(notes),
      expected_updated_at: z.iso.datetime({ offset: true }).parse(expectedUpdatedAt),
    });
    if (error) throw error;
    refresh(clinicId);
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}

export async function appointmentDetailAction(clinicId: string, appointmentId: string): Promise<UiResult> {
  try {
    return { ok: true, data: await appointmentDetail(clinicId, appointmentId) };
  } catch (error) {
    return failure(error);
  }
}

export async function createPatientInlineAction(clinicId: string, raw: unknown): Promise<UiResult> {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(160),
      phone: z.string().trim().max(40).default(""),
      email: z.union([z.email().max(254), z.literal("")]).default(""),
    }).parse(raw);
    const { client } = await requireClinic(clinicId, "patients.manage");
    const { data, error } = await client.rpc("save_core", {
      cid: clinicId,
      module: "patients",
      entity_id: null,
      payload: {
        ...input,
        internal_id: `REC-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      },
      expected_updated_at: null,
    });
    if (error) throw error;
    return { ok: true, data: { id: data, name: input.name } };
  } catch (error) {
    return failure(error);
  }
}

export async function saveCalendarPreferencesAction(clinicId: string, raw: unknown): Promise<UiResult> {
  try {
    await requireClinic(clinicId, "appointments.read");
    const { client, user } = await requireUser();
    const input = z.object({ view: calendarViewSchema, filters: calendarFiltersSchema }).parse(raw);
    const { error } = await client.from("user_preferences").upsert({
      user_id: user.id,
      calendar_view: input.view,
      calendar_filters: input.filters,
    }, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function openWhatsappReminderAction(clinicId: string, appointmentId: string): Promise<UiResult> {
  try {
    const { client } = await requireClinic(clinicId, "appointments.manage");
    const { data, error } = await client.rpc("open_whatsapp_reminder", {
      cid: clinicId,
      aid: z.uuid().parse(appointmentId),
    });
    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}
