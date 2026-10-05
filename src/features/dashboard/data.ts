import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { calendarAppointments } from "@/features/calendar/data";
import { calendarFiltersSchema } from "@/features/calendar/model";
import { whatsappRemindersSchema } from "@/features/calendar/whatsapp-reminders-model";

const dashboardSchema = z.object({
  date: z.string(),
  can_view_schedule: z.boolean(),
  metrics: z.object({
    appointments: z.number().default(0),
    confirmed: z.number().default(0),
    pending: z.number().default(0),
    completed: z.number().default(0),
    cancelled: z.number().default(0),
    no_show: z.number().default(0),
    occupancy_percent: z.number().nullable().default(null),
  }).partial().default({}),
  upcoming: z.array(z.object({
    id: z.uuid(), patient_id: z.uuid(), start_at: z.string(), end_at: z.string(),
    status: z.string(), patient_name: z.string(), service_name: z.string(),
    doctor_name: z.string().nullable(), room_name: z.string().nullable(),
  })),
  activity: z.array(z.object({
    id: z.uuid(), appointment_id: z.uuid(), event: z.string(), created_at: z.string(),
    actor_name: z.string(), patient_name: z.string(),
  })),
  alerts: z.array(z.object({
    code: z.string(), label: z.string(), count: z.number(), tone: z.string(),
  })),
});

export type OperationalDashboard = z.infer<typeof dashboardSchema>;

export async function loadOperationalDashboard(clinicId: string, localDay: string) {
  const { client } = await requireClinic(clinicId);
  const [dashboard, reminders] = await Promise.all([
    client.rpc("operational_dashboard", { cid: clinicId, local_day: localDay }),
    client.rpc("tomorrow_whatsapp_reminders", { cid: clinicId, local_day: localDay }),
  ]);
  const { data, error } = dashboard;
  if (error || reminders.error) throw new Error("Tabloul operațional nu a putut fi încărcat.");
  const parsed = dashboardSchema.safeParse(data);
  if (!parsed.success) throw new Error("Răspuns invalid pentru tabloul operațional.");
  // Use the same daily schedule as the calendar, even before migration 022 is applied.
  const calendar = parsed.data.can_view_schedule
    ? await calendarAppointments(clinicId, "day", localDay, calendarFiltersSchema.parse({}))
    : null;
  return {
    ...parsed.data,
    upcoming: calendar?.appointments.filter((item) => item.status !== "CANCELLED") ?? [],
    tomorrow_reminders: whatsappRemindersSchema.parse(reminders.data),
  };
}
