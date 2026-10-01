import { z } from "zod";
import { appointmentSourceSchema, appointmentStatusSchema } from "../scheduling/model";

export const calendarViews = ["day", "week", "month", "agenda"] as const;
export const calendarViewSchema = z.enum(calendarViews);
const filterId = z.union([z.uuid(), z.literal("")]).default("");
export const calendarFiltersSchema = z.object({
  doctor_id: filterId,
  speciality_id: filterId,
  service_id: filterId,
  room_id: filterId,
  equipment_id: filterId,
  status: z.union([appointmentStatusSchema, z.literal("")]).default(""),
});
export type CalendarFilters = z.infer<typeof calendarFiltersSchema>;

const equipmentSchema = z.object({ id: z.uuid(), name: z.string() });
export const calendarAppointmentSchema = z.object({
  id: z.uuid(),
  patient_id: z.uuid(),
  service_id: z.uuid(),
  doctor_location_id: z.uuid().nullable(),
  start_at: z.string(),
  end_at: z.string(),
  status: appointmentStatusSchema,
  source: appointmentSourceSchema,
  notes: z.string(),
  updated_at: z.string(),
  patient_name: z.string(),
  patient_phone: z.string(),
  patient_email: z.string(),
  service_name: z.string(),
  doctor_name: z.string().nullable(),
  room_id: z.uuid().nullable(),
  room_name: z.string().nullable(),
  equipment: z.array(equipmentSchema),
});
export type CalendarAppointment = z.infer<typeof calendarAppointmentSchema>;

export const appointmentDetailSchema = calendarAppointmentSchema
  .omit({ equipment: true, room_id: true, room_name: true })
  .extend({
    organization_id: z.uuid(),
    clinic_id: z.uuid(),
    duration_minutes: z.number().int(),
    buffer_before: z.number().int(),
    buffer_after: z.number().int(),
    cancellation_reason: z.string(),
    patient_internal_id: z.string(),
    resources: z.array(
      z.object({
        kind: z.enum(["room", "equipment"]),
        id: z.uuid(),
        name: z.string(),
      }),
    ),
    history: z.array(
      z.object({
        event: z.string(),
        actor_id: z.uuid().nullable(),
        old_values: z.record(z.string(), z.json()),
        new_values: z.record(z.string(), z.json()),
        reason: z.string(),
        created_at: z.string(),
      }),
    ),
  })
  .passthrough();
export type AppointmentDetail = z.infer<typeof appointmentDetailSchema>;

export const calendarSearchSchema = calendarFiltersSchema.extend({
  view: calendarViewSchema.default("week"),
  date: z.iso.date().default(() => new Date().toISOString().slice(0, 10)),
});

export function addCalendarDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function addCalendarMonths(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + amount);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

export function calendarRange(view: z.infer<typeof calendarViewSchema>, date: string) {
  const anchor = new Date(`${date}T12:00:00Z`);
  if (view === "day") return { start: date, end: addCalendarDays(date, 1) };
  if (view === "week" || view === "agenda") {
    const offset = (anchor.getUTCDay() + 6) % 7;
    const start = addCalendarDays(date, -offset);
    return { start, end: addCalendarDays(start, view === "agenda" ? 14 : 7) };
  }
  const first = `${date.slice(0, 7)}-01`;
  const firstDate = new Date(`${first}T12:00:00Z`);
  const offset = (firstDate.getUTCDay() + 6) % 7;
  const start = addCalendarDays(first, -offset);
  const nextMonth = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + 1, 1, 12));
  const last = addCalendarDays(nextMonth.toISOString().slice(0, 10), -1);
  const lastDate = new Date(`${last}T12:00:00Z`);
  const tail = 6 - ((lastDate.getUTCDay() + 6) % 7);
  return { start, end: addCalendarDays(last, tail + 1) };
}
