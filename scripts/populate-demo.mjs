import { createClient } from "@supabase/supabase-js";

// Explicit demo tool: only adds synthetic records; never runs during deployment.
process.loadEnvFile(process.env.DEMO_ENV_FILE || ".env.local");
const clinicId = process.env.DEMO_CLINIC_ID;
if (!clinicId) throw new Error("DEMO_CLINIC_ID is required.");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function read(query) {
  const result = await query;
  if (result.error) throw new Error(`Demo database operation failed (${result.error.code}).`);
  return result.data;
}
const clinic = await read(client.from("clinics").select("id,organization_id,timezone").eq("id", clinicId).single());
const templates = await read(client.from("appointments").select("*,appointment_resources(*)")
  .eq("clinic_id", clinicId).like("notes", "CM_DEMO_APPT_%").order("start_at").limit(10));
if (templates.length < 5) throw new Error("Apply seed-demo-appointments.sql to this demo clinic first.");
const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: clinic.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const today = fmt.format(new Date()).slice(0, 10);
function plusDays(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function instant(day, clock) {
  const base = Date.parse(`${day}T${clock}:00Z`);
  for (let offset = -840; offset <= 840; offset += 15) {
    const candidate = new Date(base + offset * 60_000);
    if (fmt.format(candidate) === `${day} ${clock}`) return candidate.toISOString();
  }
  throw new Error("Demo date is unavailable in the clinic timezone.");
}
let created = 0;
let skipped = 0;
const days = [];
for (let offset = 0; days.length < 3; offset++) {
  const day = plusDays(today, offset);
  if (![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) days.push(day);
}
for (const day of days) {
  const existing = await read(client.from("appointments").select("id,notes,doctor_location_id,occupied_start_at,occupied_end_at,status,appointment_resources(room_id,equipment_id)")
    .eq("clinic_id", clinicId).gte("start_at", instant(day, "00:00")).lt("start_at", instant(plusDays(day, 1), "00:00")));
  for (const [index, template] of templates.entries()) {
    const notes = `CM_DEMO_SCREENSHOT_${day}_${index + 1} · Date fictive pentru demonstrație`;
    if (existing.some(a => a.notes === notes)) { skipped++; continue; }
    const clock = fmt.format(new Date(template.start_at)).slice(11, 16);
    const start = instant(day, clock);
    const end = new Date(Date.parse(start) + template.duration_minutes * 60_000).toISOString();
    const occupiedStart = new Date(Date.parse(start) - template.buffer_before * 60_000).toISOString();
    const occupiedEnd = new Date(Date.parse(end) + template.buffer_after * 60_000).toISOString();
    const resources = template.appointment_resources;
    const conflict = existing.some(a => a.status !== "CANCELLED" && Date.parse(a.occupied_start_at) < Date.parse(occupiedEnd) && Date.parse(a.occupied_end_at) > Date.parse(occupiedStart) && (
      (a.doctor_location_id && a.doctor_location_id === template.doctor_location_id) ||
      a.appointment_resources.some(r => resources.some(t => (r.room_id && r.room_id === t.room_id) || (r.equipment_id && r.equipment_id === t.equipment_id)))
    ));
    if (conflict) { skipped++; continue; }
    const elapsed = Date.parse(end) < Date.now();
    const status = day === today && elapsed ? (index < 2 ? "COMPLETED" : "CONFIRMED") : index % 4 === 2 ? "PENDING" : "CONFIRMED";
    const appointment = await read(client.from("appointments").insert({
      organization_id: clinic.organization_id, clinic_id: clinicId, patient_id: template.patient_id,
      service_id: template.service_id, doctor_location_id: template.doctor_location_id,
      start_at: start, end_at: end, occupied_start_at: occupiedStart, occupied_end_at: occupiedEnd,
      duration_minutes: template.duration_minutes, buffer_before: template.buffer_before, buffer_after: template.buffer_after,
      status, source: "RECEPTION", notes, created_by: template.created_by,
    }).select("id").single());
    try {
      if (resources.length) await read(client.from("appointment_resources").insert(resources.map(r => ({
        organization_id: clinic.organization_id, clinic_id: clinicId, appointment_id: appointment.id,
        resource_kind: r.resource_kind, room_id: r.room_id, equipment_id: r.equipment_id,
        capacity_units: r.capacity_units, requirement_group: r.requirement_group,
      }))));
      await read(client.from("appointment_history").insert({
        organization_id: clinic.organization_id, clinic_id: clinicId, appointment_id: appointment.id,
        event: "CREATED", actor_id: template.created_by, new_values: { demo: true, status }, reason: "Date fictive pentru demo",
      }));
    } catch (error) {
      // Roll back only the new record from this run, so it can be retried safely.
      await read(client.from("appointment_resources").delete().eq("appointment_id", appointment.id));
      await read(client.from("appointments").delete().eq("id", appointment.id));
      throw error;
    }
    existing.push({ ...template, id: appointment.id, notes, status, occupied_start_at: occupiedStart, occupied_end_at: occupiedEnd });
    created++;
  }
}
console.log(`Demo: ${created} synthetic appointments added; ${skipped} existing/conflicting slots skipped. Dates: ${days.join(", ")}.`);
