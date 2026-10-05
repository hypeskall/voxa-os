import { afterAll, beforeAll, expect, test } from "vitest";
import { migratedDatabase } from "./support/database";
import { readFileSync } from "node:fs";
let db: Awaited<ReturnType<typeof migratedDatabase>>;
beforeAll(async () => { db = await migratedDatabase(); });
afterAll(async () => { await db.close(); });
async function delivery(start: string, offset: number, zone = "Europe/Bucharest") {
  const result = await db.query<{ value: string }>("select private.reminder_delivery_at($1::timestamptz,$2,$3)::text value", [start, offset, zone]);
  return new Date(result.rows[0].value).toISOString();
}
test("08:10 appointment has its two-hour reminder in the previous evening, not at 06:10", async () => {
  expect(await delivery("2026-10-05T08:10:00+03:00", 120)).toBe("2026-10-04T16:55:00.000Z");
});
test("daytime offsets are preserved and evening reminders stay before 20:00", async () => {
  expect(await delivery("2026-10-05T15:00:00+03:00", 120)).toBe("2026-10-05T10:00:00.000Z");
  expect(await delivery("2026-10-05T23:00:00+03:00", 120)).toBe("2026-10-05T16:55:00.000Z");
  expect(await delivery("2026-10-05T10:00:00+03:00", 120)).toBe("2026-10-05T05:00:00.000Z");
});
test("clinic timezone and daylight-saving transition determine the previous evening", async () => {
  expect(await delivery("2026-10-25T08:10:00+02:00", 120)).toBe("2026-10-24T16:55:00.000Z");
  expect(await delivery("2026-10-05T08:10:00Z", 120, "UTC")).toBe("2026-10-04T19:55:00.000Z");
});
test("public callers cannot enqueue reminders", async () => {
  await expect(db.query("select public.enqueue_due_reminders(now())")).rejects.toThrow("Worker access denied");
});
test("actual claim blocks night retries and cancelled appointments but allows a valid daytime reminder", async () => {
  await db.exec(readFileSync("supabase/seed-core.sql", "utf8"));
  const appointment = (await db.query<{id:string;clinic_id:string;organization_id:string}>(`insert into public.appointments(organization_id,clinic_id,patient_id,service_id,doctor_location_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after,created_by,status)
    select c.organization_id,c.id,p.id,s.id,d.id,now()+interval '100 days',now()+interval '100 days 30 minutes',now()+interval '100 days',now()+interval '100 days 30 minutes',30,0,0,m.user_id,'CONFIRMED'
    from public.clinics c join public.patients p on p.clinic_id=c.id join public.services s on s.clinic_id=c.id join public.doctor_locations d on d.clinic_id=c.id join public.clinic_memberships m on m.clinic_id=c.id and m.role='OWNER' limit 1
    returning id,clinic_id,organization_id`)).rows[0];
  const eligible = async (reference: string) => (await db.query<{value:boolean}>("select private.reminder_claimable($1,$2,$3) value", [appointment.clinic_id,appointment.id,reference])).rows[0].value;
  expect(await eligible("2026-10-05T06:05:00+03:00")).toBe(false);
  expect(await eligible("2026-10-05T12:00:00+03:00")).toBe(true);
  expect(await eligible("2026-10-05T20:05:00+03:00")).toBe(false);
  await db.query("insert into public.notification_jobs(organization_id,clinic_id,appointment_id,event,channel,recipient,idempotency_key) values($1,$2,$3,'APPOINTMENT_REMINDER','EMAIL','synthetic@example.invalid','quiet-retry')", [appointment.organization_id,appointment.clinic_id,appointment.id]);
  const claim = async () => db.transaction(async tx => {
    await tx.exec("set local role service_role");
    await tx.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
    return (await tx.query<{jobs:unknown[]}>("select public.claim_notification_jobs(25) jobs")).rows[0].jobs;
  });
  const localHour = Number((await db.query<{value:number}>("select extract(hour from now() at time zone 'Europe/Bucharest') as value")).rows[0].value);
  expect(await claim()).toHaveLength(localHour>=8 && localHour<20 ? 1 : 0);
  await db.query("update public.notification_jobs set status='FAILED',locked_at=null where idempotency_key='quiet-retry'");
  await db.query("update public.appointments set status='CANCELLED',cancelled_at=now() where id=$1", [appointment.id]);
  expect(await eligible("2026-10-05T12:00:00+03:00")).toBe(false);
  expect(await claim()).toEqual([]);
});
