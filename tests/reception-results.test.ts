import { afterAll, beforeAll, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { migratedDatabase, callerQuery, ids } from "./support/database";

let db: PGlite, patient: string, type: string, appointment: string, doctor: string, result: string;
const portal = "10000000-0000-4000-8000-000000000080";
const foreignPortal = "10000000-0000-4000-8000-000000000081";
async function one<T>(uid: string, sql: string, args: unknown[] = []) {
  return (await callerQuery<{ value: T }>(db, uid, `select ${sql} value`, args)).rows[0].value;
}
beforeAll(async () => {
  db = await migratedDatabase(true);
  await db.exec(readFileSync("supabase/seed-core.sql", "utf8"));
  patient = (await db.query<{id:string}>("select id from public.patients where clinic_id=$1 limit 1", [ids.a])).rows[0].id;
  type = (await db.query<{id:string}>("select id from public.document_types where clinic_id=$1 and code='result'", [ids.a])).rows[0].id;
  doctor = (await db.query<{id:string}>("select id from public.doctor_locations where clinic_id=$1 limit 1", [ids.a])).rows[0].id;
  const service = (await db.query<{id:string}>("select id from public.services where clinic_id=$1 limit 1", [ids.a])).rows[0].id;
  appointment = (await db.query<{id:string}>(`insert into public.appointments(organization_id,clinic_id,patient_id,service_id,doctor_location_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after,created_by) values($1,$2,$3,$4,$5,'2027-05-10T09:00:00Z','2027-05-10T09:30:00Z','2027-05-10T08:55:00Z','2027-05-10T09:35:00Z',30,5,5,$6) returning id`, [ids.org,ids.a,patient,service,doctor,ids.owner])).rows[0].id;
  result = await one(ids.doctor, "public.save_medical_result($1,null,$2,$3,'Raport audit','Text sintetic',null,'')", [ids.a,appointment,doctor]);
  await db.query("insert into auth.users(id,email) values($1,'audit-portal@example.invalid'),($2,'foreign-portal@example.invalid')", [portal, foreignPortal]);
  await one(ids.owner,"public.link_patient_identity($1,$2,$3)",[ids.a,patient,portal]);
  const otherPatient=(await db.query<{id:string}>("select id from public.patients where clinic_id=$1 and id<>$2 limit 1",[ids.a,patient])).rows[0].id;
  await one(ids.owner,"public.link_patient_identity($1,$2,$3)",[ids.a,otherPatient,foreignPortal]);
});
afterAll(async () => db.close());

test("reception reads draft and validated reports while authoring and publication stay protected", async () => {
  expect((await one<{status:string}>(ids.reception,"public.read_medical_result($1,$2)",[ids.a,result])).status).toBe("DRAFT");
  expect((await one<{id:string}[]>(ids.reception,"public.list_medical_results($1,$2)",[ids.a,patient])).map(r=>r.id)).toContain(result);
  await expect(one(ids.reception,"public.save_medical_result($1,null,$2,$3,'Forbidden','Forbidden',null,'')",[ids.a,appointment,doctor])).rejects.toThrow();
  await expect(one(ids.reception,"public.transition_medical_result($1,$2,'VALIDATED',null)",[ids.a,result])).rejects.toThrow();
  await one(ids.doctor,"public.transition_medical_result($1,$2,'VALIDATED',null)",[ids.a,result]);
  expect((await one<{status:string}>(ids.reception,"public.read_medical_result($1,$2)",[ids.a,result])).status).toBe("VALIDATED");
  await expect(one(portal,"public.read_medical_result($1,$2)",[ids.a,result])).rejects.toThrow();
  await expect(one(ids.outsider,"public.read_medical_result($1,$2)",[ids.a,result])).rejects.toThrow();
});

test("reception uploads a result and only the linked patient receives shared originals", async () => {
  const shared = await one<string>(ids.reception,"public.save_patient_document($1,$2,null,$3,'Rezultat partajat',$4,'rezultat.pdf','application/pdf',1200,true)",[ids.a,patient,type,`${ids.a}/${patient}/documents/audit-shared.pdf`]);
  const internal = await one<string>(ids.reception,"public.save_patient_document($1,$2,null,$3,'Rezultat intern',$4,'intern.pdf','application/pdf',1200,false)",[ids.a,patient,type,`${ids.a}/${patient}/documents/audit-internal.pdf`]);
  expect((await one<{id:string}[]>(ids.reception,"public.list_patient_result_uploads($1,$2)",[ids.a,patient])).map(d=>d.id)).toEqual(expect.arrayContaining([shared,internal]));
  expect((await one<{id:string}[]>(portal,"public.list_patient_result_uploads($1,$2)",[ids.a,patient])).map(d=>d.id)).toEqual([shared]);
  expect((await one<{path:string}>(portal,"public.authorize_document_download($1,$2)",[ids.a,shared])).path).toContain("audit-shared.pdf");
  await expect(one(portal,"public.authorize_document_download($1,$2)",[ids.a,internal])).rejects.toThrow();
  await expect(one(foreignPortal,"public.list_patient_result_uploads($1,$2)",[ids.a,patient])).rejects.toThrow();
  await expect(one(ids.outsider,"public.list_patient_result_uploads($1,$2)",[ids.a,patient])).rejects.toThrow();
  await expect(one(ids.reception,"public.list_patient_result_uploads($1,$2)",[ids.b,patient])).rejects.toThrow();
  expect(await one(portal,"public.can_access_medical_object($1,'read')",[`${ids.a}/${patient}/documents/audit-internal.pdf`])).toBe(false);
});

test("new result upload RPC denies MFA-stale sessions and expired subscriptions", async () => {
  const factor=(await db.query<{id:string}>("insert into auth.mfa_factors(user_id,status) values($1,'verified') returning id",[ids.reception])).rows[0].id;
  await expect(one(ids.reception,"public.list_patient_result_uploads($1,$2)",[ids.a,patient])).rejects.toThrow("MFA verification required");
  await db.query("delete from auth.mfa_factors where id=$1",[factor]);
  await db.query("update public.organization_subscriptions set trial_started_at=now()-interval '31 days',trial_ends_at=now()-interval '1 day' where organization_id=$1",[ids.org]);
  await expect(one(ids.reception,"public.list_patient_result_uploads($1,$2)",[ids.a,patient])).rejects.toThrow();
  await expect(one(portal,"public.list_patient_result_uploads($1,$2)",[ids.a,patient])).rejects.toThrow();
});
