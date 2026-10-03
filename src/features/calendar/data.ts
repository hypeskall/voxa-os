import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { localToInstant } from "@/features/core-clinic/validation";
import { optionsFor } from "@/features/core-clinic/data";
import {
  appointmentDetailSchema,
  calendarAppointmentSchema,
  calendarFiltersSchema,
  calendarRange,
  type CalendarFilters,
} from "./model";

export async function calendarAppointments(
  clinicId: string,
  view: "day" | "week" | "month" | "agenda",
  date: string,
  filters: CalendarFilters,
) {
  const { client, clinic } = await requireClinic(clinicId, "appointments.read");
  const range = calendarRange(view, date);
  const rangeStart = localToInstant(`${range.start}T00:00`, clinic.timezone);
  const rangeEnd = localToInstant(`${range.end}T00:00`, clinic.timezone);
  const [appointments, colors] = await Promise.all([client.rpc("list_calendar_appointments", {
    cid: clinicId,
    range_start: rangeStart,
    range_end: rangeEnd,
    filters: calendarFiltersSchema.parse(filters),
  }),client.rpc("doctor_calendar_colors",{cid:clinicId})]);
  const { data, error } = appointments;
  if (error || colors.error) throw new Error("Calendarul nu a putut fi încărcat.");
  const colorMap = z.record(z.string(),z.string().regex(/^#[a-fA-F0-9]{6}$/)).parse(colors.data);
  return {
    appointments: z.array(calendarAppointmentSchema).parse(data).map((a)=>({...a,doctor_color:a.doctor_location_id?colorMap[a.doctor_location_id]:undefined})),
    range,
    timeZone: clinic.timezone,
  };
}

export async function calendarOptions(clinicId: string) {
  const { client } = await requireClinic(clinicId, "catalog.read");
  const [doctors, specialities, services, rooms, equipment, links] = await Promise.all([
    optionsFor(clinicId, "doctors"),
    optionsFor(clinicId, "specialities"),
    optionsFor(clinicId, "services"),
    optionsFor(clinicId, "rooms"),
    optionsFor(clinicId, "equipment"),
    client.from("doctor_services").select("doctor_location_id,service_id").eq("clinic_id", clinicId),
  ]);
  if (links.error) throw new Error("Eligibilitatea medicilor nu a putut fi încărcată.");
  const eligibility=(links.data??[]) as {doctor_location_id:string;service_id:string}[];
  return { doctors: doctors.map((doctor) => ({ ...doctor, service_ids: eligibility.filter((link) => link.doctor_location_id === doctor.id).map((link) => link.service_id) })), specialities, services, rooms, equipment };
}

export async function appointmentDetail(clinicId: string, appointmentId: string) {
  const { client } = await requireClinic(clinicId, "appointments.read");
  const { data, error } = await client.rpc("read_appointment", {
    cid: clinicId,
    aid: z.uuid().parse(appointmentId),
  });
  if (error || !data) throw new Error("Programarea nu a putut fi încărcată.");
  return appointmentDetailSchema.parse(data);
}
