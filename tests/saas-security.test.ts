import { beforeAll,afterAll,describe,it,expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { migratedDatabase,callerQuery,ids } from "./support/database";
let db:PGlite;let patient:string;let otherPatient:string;let peerPatient:string;let affiliation:string;let otherAffiliation:string;
const query=<T=Record<string,unknown>>(uid:string,sql:string,args:unknown[]=[])=>callerQuery<T>(db,uid,sql,args);
beforeAll(async()=>{
 db=await migratedDatabase(true);await db.exec(readFileSync("supabase/seed-core.sql","utf8"));
 const patients=(await db.query<{id:string}>("select id from public.patients where clinic_id=$1 order by id limit 2",[ids.a])).rows;patient=patients[0].id;peerPatient=patients[1].id;
 otherPatient=(await db.query<{id:string}>("select id from public.patients where clinic_id=$1 limit 1",[ids.b])).rows[0].id;
 const doctors=(await db.query<{id:string}>("select id from public.doctor_locations where clinic_id=$1 order by id limit 1",[ids.a])).rows;affiliation=doctors[0].id;
 const peer=(await db.query<{id:string}>("insert into public.doctors(organization_id,name,professional_code) values($1,'Alt medic','SEC-PEER') returning id",[ids.org])).rows[0].id;
 otherAffiliation=(await db.query<{id:string}>("insert into public.doctor_locations(organization_id,clinic_id,doctor_id) values($1,$2,$3) returning id",[ids.org,ids.a,peer])).rows[0].id;
 await db.query("update public.doctor_locations set staff_user_id=$1 where id=$2",[ids.doctor,affiliation]);
 const service=(await db.query<{id:string}>("select id from public.services where clinic_id=$1 limit 1",[ids.a])).rows[0].id;
 for(const [pid,did,hour] of [[patient,affiliation,10],[peerPatient,otherAffiliation,11]] as const)
  await db.query("insert into public.appointments(organization_id,clinic_id,patient_id,doctor_location_id,service_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after) values($1,$2,$3,$4,$5,$6::timestamptz,$6::timestamptz+interval '30 minutes',$6::timestamptz,$6::timestamptz+interval '30 minutes',30,0,0)",[ids.org,ids.a,pid,did,service,`2026-11-02T${hour}:00:00Z`]);
});
afterAll(async()=>{await db.close();});
describe("SaaS medical storage policies and clinical least privilege",()=>{
 it("provisions private buckets and exercises actual storage RLS",async()=>{
  expect((await db.query<{public:boolean}>("select public from storage.buckets")).rows.every(r=>r.public===false)).toBe(true);
  await query(ids.reception,"insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",[`${ids.a}/${patient}/documents/valid.pdf`]);
  for(const path of [`${ids.b}/${otherPatient}/documents/cross.pdf`,`${ids.a}/${otherPatient}/documents/spoof.pdf`,`${ids.c}/${patient}/documents/cross-org.pdf`,`${ids.a}/doctors/${otherAffiliation}/signature/test.png`])
   await expect(query(ids.reception,"insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",[path])).rejects.toThrow();
  expect((await query(ids.outsider,"select * from storage.objects")).rows).toHaveLength(0);
 });
 it("isolates branding and allows only organization owners to upload",async()=>{
  await query(ids.owner,"insert into storage.objects(bucket_id,name) values('voxa-branding',$1)",[`${ids.org}/logo/actual.png`]);
  await expect(query(ids.owner,"insert into storage.objects(bucket_id,name) values('voxa-branding',$1)",[`${ids.otherOrg}/logo/forbidden.png`])).rejects.toThrow();
  await expect(query(ids.reception,"insert into storage.objects(bucket_id,name) values('voxa-branding',$1)",[`${ids.org}/logo/forbidden.png`])).rejects.toThrow();
 });
 it("doctor sees own schedule and patient without general appointment/patient grants",async()=>{
  const rows=(await query<{result:{patient_id:string}[]}>(ids.doctor,"select public.my_doctor_schedule($1,'2026-11-02','2026-11-02') result",[ids.a])).rows[0].result;
  expect(rows.map(r=>r.patient_id)).toEqual([patient]);
  expect((await query(ids.doctor,"select * from public.appointments")).rows).toHaveLength(0);
  expect((await query(ids.doctor,"select * from public.patients")).rows).toHaveLength(0);
  await expect(query(ids.doctor,"select public.read_workflow_patient($1,$2)",[ids.a,peerPatient])).rejects.toThrow("Access denied");
  await expect(query(ids.doctor,"select public.read_workflow_patient($1,$2)",[ids.b,otherPatient])).rejects.toThrow("Access denied");
 });
 it("doctor document paths and notes are restricted to their own workflow",async()=>{
  await query(ids.doctor,"insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",[`${ids.a}/${patient}/documents/doctor.pdf`]);
  await expect(query(ids.doctor,"insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",[`${ids.a}/${peerPatient}/documents/spoof.pdf`])).rejects.toThrow();
  await query(ids.doctor,"select public.add_patient_note($1,$2,'Notă clinică privată')",[ids.a,patient]);
  await query(ids.reception,"select public.add_patient_note($1,$2,'Notă alt pacient')",[ids.a,peerPatient]);
  expect((await query(ids.doctor,"select * from public.patient_notes")).rows).toHaveLength(1);
  await expect(query(ids.doctor,"select public.add_patient_note($1,$2,'Notă interzisă')",[ids.a,peerPatient])).rejects.toThrow("Access denied");
  expect(JSON.stringify((await db.query("select metadata from public.audit_logs where entity='patient_notes'")).rows)).not.toContain("Notă clinică privată");
 });
 it("blocks another doctor's medical metadata, RPCs and credential reassignment",async()=>{
  const type=(await db.query<{id:string}>("select id from public.document_types where clinic_id=$1 limit 1",[ids.a])).rows[0].id;
  const docIds:string[]=[],resultIds:string[]=[];
  for(const [pid,did] of [[patient,affiliation],[peerPatient,otherAffiliation]]){
   const document=(await query<{id:string}>(ids.owner,"select public.save_patient_document($1,$2,null,$3,'Document clinic',$4,'document.pdf','application/pdf',100,false) id",[ids.a,pid,type,`${ids.a}/${pid}/documents/metadata.pdf`])).rows[0].id;docIds.push(document);
   const aid=(await db.query<{id:string}>("select id from public.appointments where patient_id=$1 and doctor_location_id=$2",[pid,did])).rows[0].id;
   resultIds.push((await query<{id:string}>(ids.owner,"select public.save_medical_result($1,null,$2,$3,'Rezultat clinic','Conținut privat',null,'') id",[ids.a,aid,did])).rows[0].id);
  }
  expect((await query(ids.doctor,"select * from public.patient_documents")).rows).toHaveLength(1);
  expect((await query(ids.doctor,"select * from public.medical_results")).rows).toHaveLength(1);
  expect((await query(ids.doctor,"select * from public.medical_result_versions")).rows).toHaveLength(1);
  await expect(query(ids.doctor,"select public.list_patient_documents($1,$2)",[ids.a,peerPatient])).rejects.toThrow("Access denied");
  await expect(query(ids.doctor,"select public.authorize_document_download($1,$2)",[ids.a,docIds[1]])).rejects.toThrow("Access denied");
  await expect(query(ids.doctor,"select public.read_medical_result($1,$2)",[ids.a,resultIds[1]])).rejects.toThrow("Access denied");
  expect((await query<{result:unknown[]}>(ids.doctor,"select public.list_medical_results($1,null) result",[ids.a])).rows[0].result).toHaveLength(1);
  await expect(query(ids.doctor,"select public.set_doctor_credentials($1,$2,$3,null,null,null,null)",[ids.a,otherAffiliation,ids.doctor])).rejects.toThrow("Access denied");
  await expect(query(ids.doctor,"insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",[`${ids.a}/${peerPatient}/results/${resultIds[1]}/spoof.pdf`])).rejects.toThrow();
 });
 it("allows failed-upload cleanup while keeping registered originals immutable",async()=>{
  const path=`${ids.a}/${patient}/documents/metadata.pdf`;
  await query(ids.reception,"insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",[path]);
  expect((await query(ids.reception,"delete from storage.objects where name=$1 returning id",[path])).rows).toHaveLength(0);
  expect((await query(ids.reception,"update storage.objects set name=name||'.changed' where name=$1 returning id",[path])).rows).toHaveLength(0);
  const orphan=`${ids.a}/${patient}/documents/cleanup.pdf`;
  await query(ids.reception,"insert into storage.objects(bucket_id,name) values('voxa-medical',$1)",[orphan]);
  expect((await query(ids.reception,"delete from storage.objects where name=$1 returning id",[orphan])).rows).toHaveLength(1);
 });
 it("exports and privacy reviews require owner access and preserve audit integrity",async()=>{
  await expect(query(ids.reception,"select public.export_patient($1,$2)",[ids.a,patient])).rejects.toThrow("Access denied");
  await expect(query(ids.outsider,"select public.export_patient($1,$2)",[ids.a,patient])).rejects.toThrow("Access denied");
  const result=(await query<{result:{patient:{id:string}}}>(ids.owner,"select public.export_patient($1,$2) result",[ids.a,patient])).rows[0].result;expect(result.patient.id).toBe(patient);
  const rid=(await query<{id:string}>(ids.owner,"select public.request_patient_privacy($1,$2,'anonymization','Solicitare verificată a pacientului') id",[ids.a,patient])).rows[0].id;
  await expect(query(ids.reception,"select public.review_privacy_request($1,$2,'approved','Cerere analizată și aprobată')",[ids.a,rid])).rejects.toThrow("Access denied");
  await expect(query(ids.owner,"select public.review_privacy_request($1,$2,'completed','Proces confirmat înainte de aprobare')",[ids.a,rid])).rejects.toThrow("Request unavailable");
  await query(ids.owner,"select public.review_privacy_request($1,$2,'approved','Cerere analizată și aprobată')",[ids.a,rid]);
  expect((await query(ids.owner,"select * from public.patients where id=$1",[patient])).rows).toHaveLength(1);
 });
 it("durably queues only authorized unregistered uploads without exposing paths",async()=>{
  const path=`${ids.a}/${patient}/documents/failed-compensation.pdf`;
  const id=(await query<{id:string}>(ids.reception,"select public.queue_storage_cleanup('voxa-medical',$1) id",[path])).rows[0].id;
  expect((await query<{id:string}>(ids.reception,"select public.queue_storage_cleanup('voxa-medical',$1) id",[path])).rows[0].id).toBe(id);
  await expect(query(ids.reception,"select * from public.storage_cleanup_jobs")).rejects.toThrow();
  await expect(query(ids.reception,"select public.queue_storage_cleanup('voxa-medical',$1)",[`${ids.b}/${otherPatient}/documents/cross.pdf`])).rejects.toThrow("Access denied");
  await expect(query(ids.reception,"select public.queue_storage_cleanup('voxa-medical',$1)",[`${ids.a}/${patient}/documents/metadata.pdf`])).rejects.toThrow("Access denied");
  await expect(query(ids.reception,"select public.storage_cleanup_unreferenced($1)",[id])).rejects.toThrow();
  expect((await db.query<{safe:boolean}>("select public.storage_cleanup_unreferenced($1) safe",[id])).rows[0].safe).toBe(true);
  const type=(await db.query<{id:string}>("select id from public.document_types where clinic_id=$1 limit 1",[ids.a])).rows[0].id;
  await query(ids.owner,"select public.save_patient_document($1,$2,null,$3,'Document înregistrat',$4,'document.pdf','application/pdf',100,false)",[ids.a,patient,type,path]);
  expect((await db.query<{safe:boolean}>("select public.storage_cleanup_unreferenced($1) safe",[id])).rows[0].safe).toBe(false);
 });
 it("revoked clinicians immediately lose schedule, notes and storage access",async()=>{
  await db.query("update public.clinic_memberships set active=false where user_id=$1 and clinic_id=$2",[ids.doctor,ids.a]);
  await expect(query(ids.doctor,"select public.my_doctor_schedule($1,'2026-11-02','2026-11-02')",[ids.a])).rejects.toThrow("Access denied");
  expect((await query(ids.doctor,"select * from public.patient_notes")).rows).toHaveLength(0);
  expect((await query(ids.doctor,"select * from storage.objects")).rows).toHaveLength(0);
 });
});
