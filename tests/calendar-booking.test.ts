import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { callerQuery, ids, migratedDatabase } from "./support/database";

let db: PGlite;
const fixture: Record<string, string> = {};
const requestKey = "a".repeat(64);
async function asAnon<T>(sql: string, args: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return tx.query<T>(sql, args);
  });
}
async function internalCreate(patient: string, start: string) {
  const { rows } = await callerQuery<{ result: { ok: boolean; appointment_id: string; updated_at: string } }>(db, ids.reception,
    "select public.create_appointment($1,$2) result",
    [ids.a, { patient_id: patient, service_id: fixture.service, start_at: start, equipment_ids: [] }]);
  return rows[0].result;
}
async function publicSlots(day = "2027-02-01", doctor: string | null = null) {
  const { rows } = await asAnon<{ result: { start_at: string }[] }>(
    "select public.public_available_slots('clinic-a',$1,$2,$3,$4) result",
    [fixture.service, day, doctor, requestKey],
  );
  return rows[0].result.map((slot) => new Date(slot.start_at).toISOString());
}
async function publicBook(index: number, start: string, key = requestKey) {
  const { rows } = await asAnon<{ result: { ok: boolean; appointment_id?: string; code?: string } }>(
    "select public.create_public_booking('clinic-a',$1,$2) result",
    [{ service_id: fixture.service, doctor_id: fixture.doctor, start_at: start, name: `Web Patient ${index}`, email: `web${index}@example.test`, phone: "" }, key],
  );
  return rows[0].result;
}

beforeAll(async () => {
  db = await migratedDatabase();
  await db.query("update public.clinics set public_booking_enabled=true,booking_slug='clinic-a' where id=$1", [ids.a]);
  await db.query("update public.clinics set public_booking_enabled=true,booking_slug='clinic-b' where id=$1", [ids.b]);
  const patients = await db.query<{ id: string }>(
    "insert into public.patients(organization_id,clinic_id,name,internal_id) values($1,$2,'Reception One','CAL-1'),($1,$2,'Reception Two','CAL-2'),($1,$2,'Reception Three','CAL-3') returning id",
    [ids.org, ids.a],
  );
  patients.rows.forEach((patient, index) => fixture[`patient${index + 1}`] = patient.id);
  const doctor = await db.query<{ id: string }>("insert into public.doctors(organization_id,name,professional_code) values($1,'Dr Calendar','CAL-DOC') returning id", [ids.org]);
  const location = await db.query<{ id: string }>("insert into public.doctor_locations(organization_id,clinic_id,doctor_id) values($1,$2,$3) returning id", [ids.org, ids.a, doctor.rows[0].id]);
  fixture.doctor = location.rows[0].id;
  const otherDoctor = await db.query<{ id: string }>("insert into public.doctors(organization_id,name,professional_code) values($1,'Dr Invalid','CAL-OTHER') returning id", [ids.org]);
  const otherLocation = await db.query<{ id: string }>("insert into public.doctor_locations(organization_id,clinic_id,doctor_id) values($1,$2,$3) returning id", [ids.org, ids.a, otherDoctor.rows[0].id]);
  fixture.invalidDoctor = otherLocation.rows[0].id;
  const room = await db.query<{ id: string }>("insert into public.rooms(organization_id,clinic_id,name) values($1,$2,'Calendar room') returning id", [ids.org, ids.a]);
  fixture.room = room.rows[0].id;
  const service = await db.query<{ id: string }>("insert into public.services(organization_id,clinic_id,name,duration_minutes,doctor_requirement,room_required) values($1,$2,'Calendar consultation',30,'required',true) returning id", [ids.org, ids.a]);
  fixture.service = service.rows[0].id;
  await db.query("insert into public.doctor_services(doctor_location_id,service_id,clinic_id) values($1,$2,$3)", [fixture.doctor, fixture.service, ids.a]);
  await db.query("insert into public.service_rooms(service_id,room_id,clinic_id) values($1,$2,$3)", [fixture.service, fixture.room, ids.a]);
  for (let weekday = 1; weekday <= 5; weekday++) {
    for (const [kind, doctorId, roomId] of [["clinic", null, null], ["doctor", fixture.doctor, null], ["room", null, fixture.room]] as const)
      await db.query(`insert into public.availability_rules(organization_id,clinic_id,name,resource_kind,doctor_location_id,room_id,weekday,start_time,end_time,valid_from)
       values($1,$2,$3,$4,$5,$6,$7,'08:00','18:00','2026-01-01')`, [ids.org, ids.a, `${kind}-${weekday}`, kind, doctorId, roomId, weekday]);
  }
});
afterAll(async () => db.close());

describe("Calendar and public booking share the scheduling engine", () => {
  it("reception creates an appointment that appears in the bounded calendar query", async () => {
    const created = await internalCreate(fixture.patient1, "2027-02-01T09:00:00Z");
    expect(created.ok).toBe(true);
    fixture.internalAppointment = created.appointment_id;
    fixture.internalVersion = created.updated_at;
    const { rows } = await callerQuery<{ result: { id: string }[] }>(db, ids.reception,
      "select public.list_calendar_appointments($1,$2,$3,'{}') result",
      [ids.a, "2027-02-01T00:00:00Z", "2027-02-02T00:00:00Z"]);
    expect(rows[0].result.some((item) => item.id === created.appointment_id)).toBe(true);
  });
  it("removes an internally occupied slot from public availability", async () => {
    expect(await publicSlots()).not.toContain("2027-02-01T09:00:00.000Z");
  });
  it("creates a website booking and exposes it internally without patient enumeration", async () => {
    const result = await publicBook(1, "2027-02-01T10:00:00Z");
    expect(result.ok).toBe(true);
    fixture.publicAppointment = result.appointment_id!;
    const { rows } = await callerQuery<{ source: string; created_by: string | null }>(db, ids.reception,
      "select source,created_by from public.appointments where id=$1", [fixture.publicAppointment]);
    expect(rows).toEqual([{ source: "WEBSITE", created_by: null }]);
  });
  it("reception reschedules and public availability reflects old and new slots", async () => {
    const result = await callerQuery<{ result: { ok: boolean; updated_at: string } }>(db, ids.reception,
      "select public.reschedule_appointment($1,$2,$3,$4) result",
      [ids.a, fixture.internalAppointment, { start_at: "2027-02-01T11:00:00Z", equipment_ids: [] }, fixture.internalVersion]);
    expect(result.rows[0].result.ok).toBe(true);
    fixture.internalVersion = result.rows[0].result.updated_at;
    const slots = await publicSlots();
    expect(slots).toContain("2027-02-01T09:00:00.000Z");
    expect(slots).not.toContain("2027-02-01T11:00:00.000Z");
  });
  it("resizes an appointment to 45 minutes and persists its new end", async () => {
    const result = await callerQuery<{ result: { ok: boolean; updated_at: string } }>(db, ids.reception,
      "select public.resize_appointment($1,$2,$3,$4) result",
      [ids.a, fixture.internalAppointment, 45, fixture.internalVersion]);
    expect(result.rows[0].result.ok).toBe(true);
    fixture.internalVersion = result.rows[0].result.updated_at;
    const appointment = await db.query<{ duration_minutes: number; start_at: Date; end_at: Date }>(
      "select duration_minutes,start_at,end_at from public.appointments where id=$1",
      [fixture.internalAppointment],
    );
    expect(appointment.rows[0].duration_minutes).toBe(45);
    expect(appointment.rows[0].end_at.getTime()-appointment.rows[0].start_at.getTime()).toBe(45*60_000);
  });
  it("reception edits appointment notes and rejects a stale revision", async () => {
    const previous = fixture.internalVersion;
    const edited = await callerQuery<{ result: { ok: boolean; updated_at: string } }>(db, ids.reception,
      "select public.update_appointment_notes($1,$2,$3,$4) result",
      [ids.a, fixture.internalAppointment, "Synthetic appointment note", previous]);
    expect(edited.rows[0].result.ok).toBe(true);
    fixture.internalVersion = edited.rows[0].result.updated_at;
    const saved = await callerQuery<{ notes: string }>(db, ids.reception,
      "select notes from public.appointments where id=$1", [fixture.internalAppointment]);
    expect(saved.rows[0].notes).toBe("Synthetic appointment note");
    await expect(callerQuery(db, ids.reception,
      "select public.update_appointment_notes($1,$2,$3,$4)",
      [ids.a, fixture.internalAppointment, "Stale overwrite", previous])).rejects.toThrow("Stale version");
  });
  it("logs a WhatsApp opening in patient communications without claiming delivery and rejects foreign IDs", async () => {
    await db.query("update public.patients set phone='0700000001' where id=$1", [fixture.patient1]);
    await callerQuery(db, ids.reception, "select public.open_whatsapp_reminder($1,$2)", [ids.a,fixture.internalAppointment]);
    const communications = await callerQuery<{channel:string;direction:string;summary:string}>(db, ids.reception,
      "select channel,direction,summary from public.manual_patient_communications where patient_id=$1", [fixture.patient1]);
    expect(communications.rows).toEqual([{channel:"WHATSAPP",direction:"OUTBOUND",summary:"Memento WhatsApp deschis. Trimiterea mesajului nu este confirmată."}]);
    await expect(callerQuery(db, ids.outsider, "select public.open_whatsapp_reminder($1,$2)", [ids.a,fixture.internalAppointment])).rejects.toThrow("Access denied");
    await expect(callerQuery(db, ids.owner, "select public.open_whatsapp_reminder($1,$2)", [ids.b,fixture.internalAppointment])).rejects.toThrow("Appointment unavailable");
    const denied = await callerQuery(db, ids.outsider, "select id from public.manual_patient_communications where patient_id=$1", [fixture.patient1]);
    expect(denied.rows).toHaveLength(0);
    expect((await db.query("select id from public.manual_patient_communications where patient_id=$1", [fixture.patient1])).rows).toHaveLength(1);
  });
  it("cancellation frees the public slot", async () => {
    const appointment = await db.query<{ updated_at: Date }>("select updated_at from public.appointments where id=$1", [fixture.publicAppointment]);
    await callerQuery(db, ids.reception, "select public.cancel_appointment($1,$2,'Cancelled',$3)", [ids.a, fixture.publicAppointment, appointment.rows[0].updated_at]);
    expect(await publicSlots()).toContain("2027-02-01T10:00:00.000Z");
  });
  it("rejects a drag/reschedule to a conflicting slot without changing the original", async () => {
    const second = await internalCreate(fixture.patient2, "2027-02-02T09:00:00Z");
    const third = await internalCreate(fixture.patient3, "2027-02-02T10:00:00Z");
    const attempt = await callerQuery<{ result: { ok: boolean } }>(db, ids.reception,
      "select public.reschedule_appointment($1,$2,$3,$4) result",
      [ids.a, second.appointment_id, { start_at: "2027-02-02T10:00:00Z", equipment_ids: [] }, second.updated_at]);
    expect(attempt.rows[0].result.ok).toBe(false);
    const unchanged = await db.query<{ start_at: Date }>("select start_at from public.appointments where id=$1", [second.appointment_id]);
    expect(unchanged.rows[0].start_at.toISOString()).toBe("2027-02-02T09:00:00.000Z");
    fixture.conflictAppointment = third.appointment_id;
  });
  it("allows only one of two concurrent website bookings for one slot", async () => {
    const [first, second] = await Promise.all([
      publicBook(2, "2027-02-03T09:00:00Z", "b".repeat(64)),
      publicBook(3, "2027-02-03T09:00:00Z", "c".repeat(64)),
    ]);
    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
  });
  it("does not expose another clinic through a slug/service mismatch", async () => {
    await expect(asAnon("select public.public_available_slots('clinic-b',$1,'2027-02-01',null,$2)", [fixture.service, requestKey])).rejects.toThrow("Invalid service");
  });
  it("rejects an invalid doctor/service combination", async () => {
    await expect(publicSlots("2027-02-04", fixture.invalidDoctor)).rejects.toThrow("Invalid doctor");
  });
  it("keeps internal calendar RPCs unavailable to anonymous callers", async () => {
    await expect(asAnon("select public.list_calendar_appointments($1,now(),now()+interval '1 day','{}')", [ids.a])).rejects.toThrow();
  });
});
