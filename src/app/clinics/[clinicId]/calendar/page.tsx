import { localDate } from "@/lib/time";
import { can } from "@/lib/permissions";
import { requireClinic, workspace } from "@/features/auth/access";
import { calendarAppointments, calendarOptions, tomorrowWhatsappReminders } from "@/features/calendar/data";
import { addCalendarDays, calendarFiltersSchema, calendarViewSchema } from "@/features/calendar/model";
import { CalendarWorkspace } from "@/features/calendar/calendar-workspace";
import { z } from "zod";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clinicId } = await params;
  const query = await searchParams;
  const [context, account] = await Promise.all([
    requireClinic(clinicId, "appointments.read"),
    workspace(),
  ]);
  const savedFilters = calendarFiltersSchema.safeParse(account.preferences?.calendar_filters);
  const requestedView = typeof query.view === "string" ? query.view : account.preferences?.calendar_view;
  const view = calendarViewSchema.catch("week").parse(requestedView);
  const today = localDate(context.clinic.timezone);
  const date = z.iso.date().safeParse(query.date).success ? String(query.date) : today;
  const filters = calendarFiltersSchema.parse({
    ...(savedFilters.success ? savedFilters.data : {}),
    ...Object.fromEntries(
      ["doctor_id", "speciality_id", "service_id", "room_id", "equipment_id", "status"]
        .filter((key) => typeof query[key] === "string")
        .map((key) => [key, query[key]]),
    ),
  });
  const canManage = can(context.permissions, "appointments.manage");
  const [calendar, options, reminders] = await Promise.all([
    calendarAppointments(clinicId, view, date, filters),
    calendarOptions(clinicId),
    canManage ? tomorrowWhatsappReminders(clinicId, today) : Promise.resolve([]),
  ]);
  return (
    <CalendarWorkspace
      clinicId={clinicId}
      clinicName={context.clinic.name}
      clinicAddress={context.clinic.address}
      clinicPhone={context.clinic.phone}
      whatsappTemplate={context.clinic.whatsapp_reminder_template}
      tomorrowReminders={reminders}
      tomorrowDate={addCalendarDays(today, 1)}
      appointments={calendar.appointments}
      range={calendar.range}
      timeZone={calendar.timeZone}
      view={view}
      date={date}
      filters={filters}
      options={options}
      canManage={canManage}
      canOverride={can(context.permissions, "appointments.override")}
      initialAppointment={z.uuid().safeParse(query.appointment).success ? String(query.appointment) : null}
      incrementMinutes={context.clinic.scheduling_increment_minutes}
      visibleStart={context.clinic.calendar_visible_start}
      visibleEnd={context.clinic.calendar_visible_end}
    />
  );
}
