import { beforeAll,afterAll,describe,it,expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { migratedDatabase,callerQuery,ids } from "./support/database";
import { setupDraft } from "./support/setup";
import { createHash,randomBytes } from "node:crypto";
let db:PGlite;const fresh="10000000-0000-4000-8000-000000000020";
let cid:string;let oid:string;
const query=<T=Record<string,unknown>>(uid:string,sql:string,args:unknown[]=[])=>callerQuery<T>(db,uid,sql,args);
beforeAll(async()=>{db=await migratedDatabase();await db.query("insert into auth.users(id,email) values($1,'owner@clinica-test.ro')",[fresh]);});
afterAll(async()=>{await db.close();});
describe("migrated SaaS lifecycle",()=>{
 it("atomically creates organization, location, owner, trial and draft",async()=>{
  cid=(await query<{id:string}>(fresh,"select public.create_organization('Clinica Test','Oradea') id")).rows[0].id;
  const org=(await query<{organization_id:string}>(fresh,"select organization_id from public.clinics where id=$1",[cid])).rows[0];oid=org.organization_id;
  const rows=(await query<{role:string;onboarding_completed:boolean;days:number}>(fresh,"select m.role,o.onboarding_completed,extract(day from (trial_ends_at-trial_started_at)) days from public.organizations o join public.organization_members m on m.organization_id=o.id where o.id=$1",[oid])).rows;
  expect(rows).toEqual([{role:"OWNER",onboarding_completed:false,days:"30"}]);
  expect((await query(fresh,"select * from public.onboarding_drafts where organization_id=$1",[oid])).rows).toHaveLength(1);
 });
 it("persists drafts, rejects stale versions and denies crafted cross-tenant saves",async()=>{
  const draft=setupDraft(cid);
  expect((await query<{v:number}>(fresh,"select public.save_onboarding($1,$2,5,0) v",[oid,draft])).rows[0].v).toBe(1);
  expect((await query<{payload:unknown}>(fresh,"select payload from public.onboarding_drafts where organization_id=$1",[oid])).rows[0].payload).toEqual(draft);
  await expect(query(fresh,"select public.save_onboarding($1,$2,5,0)",[oid,draft])).rejects.toThrow("Stale version");
  await expect(query(ids.outsider,"select public.save_onboarding($1,$2,5,1)",[oid,draft])).rejects.toThrow("Access denied");
 });
 it("rolls back the complete configuration when a resource targets another tenant",async()=>{
  const draft=setupDraft(cid);draft.services[0].location_id=ids.c;
  await query(fresh,"select public.save_onboarding($1,$2,8,1)",[oid,draft]);
  await expect(query(fresh,"select public.finish_onboarding($1,2)",[oid])).rejects.toThrow("Invalid service location");
  expect((await query(fresh,"select * from public.services where organization_id=$1",[oid])).rows).toHaveLength(0);
  expect((await query<{onboarding_completed:boolean}>(fresh,"select onboarding_completed from public.organizations where id=$1",[oid])).rows[0].onboarding_completed).toBe(false);
 });
 it("finalizes actual clinic resources and creates/reschedules a persistent appointment",async()=>{
  const draft=setupDraft(cid);draft.rooms=[{id:"70000000-0000-4000-8000-000000000001",location_id:cid,name:"Cabinet 1",description:""}];
  await query(fresh,"select public.save_onboarding($1,$2,8,2)",[oid,draft]);
  expect((await query<{id:string}>(fresh,"select public.finish_onboarding($1,3) id",[oid])).rows[0].id).toBe(cid);
  expect((await query(fresh,"select * from public.doctor_services where clinic_id=$1",[cid])).rows).toHaveLength(1);
  const patient=(await query<{id:string}>(fresh,"select public.save_core($1,'patients',null,$2) id",[cid,{name:"Ion Popescu",internal_id:"TEST-1",phone:"0712345678"}])).rows[0].id;
  const doctor=(await query<{id:string}>(fresh,"select id from public.doctor_locations where clinic_id=$1",[cid])).rows[0].id;
  const day=new Date();do{day.setUTCDate(day.getUTCDate()+1);}while([0,6].includes(day.getUTCDay()));const date=day.toISOString().slice(0,10);
  const payload={patient_id:patient,service_id:draft.services[0].id,doctor_id:doctor,start_at:`${date}T07:00:00Z`,source:"RECEPTION",notes:""};
  const created=(await query<{result:{ok:boolean;appointment_id:string}}>(fresh,"select public.create_appointment($1,$2) result",[cid,payload])).rows[0].result;
  expect(created.ok).toBe(true);
  const appointment=(await query<{updated_at:string}>(fresh,"select updated_at from public.appointments where id=$1",[created.appointment_id])).rows[0];
  const moved=(await query<{result:{ok:boolean}}>(fresh,"select public.reschedule_appointment($1,$2,$3,$4) result",[cid,created.appointment_id,{...payload,start_at:`${date}T08:00:00Z`},appointment.updated_at])).rows[0].result;
  expect(moved.ok).toBe(true);
  expect((await query(fresh,"select * from public.appointments where id=$1",[created.appointment_id])).rows).toHaveLength(1);
  expect((await query(ids.outsider,"select * from public.patients where id=$1",[patient])).rows).toHaveLength(0);
  await expect(query(ids.outsider,"select public.cancel_appointment($1,$2,'Bad request',null)",[cid,created.appointment_id])).rejects.toThrow("Access denied");
  expect((await query(ids.outsider,"select * from public.organization_settings where organization_id=$1",[oid])).rows).toHaveLength(0);
  await expect(query(fresh,"select public.finish_onboarding($1,3)",[oid])).rejects.toThrow("Setup already completed");
 });
 it("uses hashed expiring invitations bound to a verified email and a location",async()=>{
  const token=randomBytes(32).toString("base64url"),digest=createHash("sha256").update(token).digest("hex");
  const invited="10000000-0000-4000-8000-000000000021";await db.query("insert into auth.users(id,email) values($1,'colleague@clinica-test.ro')",[invited]);
  await query(fresh,"select public.create_staff_invite($1,'colleague@clinica-test.ro','RECEPTION',$2)",[cid,digest]);
  await expect(query(ids.outsider,"select public.accept_staff_invite($1)",[digest])).rejects.toThrow("Invitation unavailable");
  await db.query("update auth.users set email_confirmed_at=null where id=$1",[invited]);await expect(query(invited,"select public.accept_staff_invite($1)",[digest])).rejects.toThrow("Invitation unavailable");
  await db.query("update auth.users set email_confirmed_at=now() where id=$1",[invited]);
  expect((await query<{id:string}>(invited,"select public.accept_staff_invite($1) id",[digest])).rows[0].id).toBe(cid);
  expect((await query<{role:string}>(invited,"select role from public.organization_members where organization_id=$1",[oid])).rows).toEqual([{role:"RECEPTION"}]);
  await expect(query(invited,"select token_hash from public.organization_invites")).rejects.toThrow();
  await expect(query(invited,"select public.accept_staff_invite($1)",[digest])).rejects.toThrow("Invitation unavailable");
  await expect(query(invited,"select public.create_staff_invite($1,'other@test.ro','ADMIN',$2)",[cid,"a".repeat(64)])).rejects.toThrow("Access denied");
  await expect(query(fresh,"select public.create_staff_invite($1,'other@test.ro','OWNER',$2)",[cid,"b".repeat(64)])).rejects.toThrow();
 });
 it("rejects expired, revoked and issuer-revoked invitation tokens",async()=>{
  const invitee="10000000-0000-4000-8000-000000000022";await db.query("insert into auth.users(id,email) values($1,'next@clinica-test.ro')",[invitee]);
  for(const condition of ["expired","revoked"]){
   const digest=createHash("sha256").update(condition).digest("hex");const iid=(await query<{id:string}>(fresh,"select public.create_staff_invite($1,'next@clinica-test.ro','DOCTOR',$2) id",[cid,digest])).rows[0].id;
   if(condition==="expired")await db.query("update public.organization_invites set expires_at=now()-interval '1 hour' where id=$1",[iid]);
   if(condition==="revoked")await query(fresh,"select public.revoke_staff_invite($1)",[iid]);
   await expect(query(invitee,"select public.accept_staff_invite($1)",[digest])).rejects.toThrow("Invitation unavailable");
  }
  await db.query("insert into public.clinic_memberships(user_id,organization_id,clinic_id,role) values($1,$2,$3,'ADMIN')",[ids.admin,oid,cid]);
  const digest=createHash("sha256").update("issuer-revoked").digest("hex");
  await query(ids.admin,"select public.create_staff_invite($1,'next@clinica-test.ro','DOCTOR',$2)",[cid,digest]);
  await db.query("update public.clinic_memberships set active=false where user_id=$1 and clinic_id=$2",[ids.admin,cid]);
  await expect(query(invitee,"select public.accept_staff_invite($1)",[digest])).rejects.toThrow("Invitation unavailable");
 });
 it("protects organization ownership and sensitive subscription/settings fields",async()=>{
  await expect(db.query("update public.clinic_memberships set active=false where user_id=$1",[fresh])).rejects.toThrow("Last organization owner");
  await expect(query(fresh,"update public.organizations set onboarding_completed=false where id=$1",[oid])).rejects.toThrow();
  await expect(query(ids.reception,"select public.save_organization_identity($1,$2)",[oid,{name:"Hijacked"}])).rejects.toThrow("Access denied");
 });
 it("preserves all fields for a new location and rejects unauthorized creation",async()=>{
  const payload={name:"Nord",address:"Strada Nord 2",city:"Oradea",county:"Bihor",postal_code:"410001",phone:"0712345678",email:"nord@clinica-test.ro",timezone:"Europe/Bucharest",scheduling_increment_minutes:10};
  const location=(await query<{id:string}>(fresh,"select public.create_location($1,$2) id",[oid,payload])).rows[0].id;
  const row=(await query<{city:string;county:string;postal_code:string;phone:string;email:string;scheduling_increment_minutes:number}>(fresh,"select city,county,postal_code,phone,email,scheduling_increment_minutes from public.clinics where id=$1",[location])).rows[0];
  expect(row).toEqual({city:payload.city,county:payload.county,postal_code:payload.postal_code,phone:payload.phone,email:payload.email,scheduling_increment_minutes:10});
  await expect(query(ids.reception,"select public.create_location($1,$2)",[oid,payload])).rejects.toThrow("Access denied");
 });
 it("isolates a second newly registered organization's crafted reads and mutations",async()=>{
  const second="10000000-0000-4000-8000-000000000023";await db.query("insert into auth.users(id,email) values($1,'owner@clinica-b.ro')",[second]);
  const location=(await query<{id:string}>(second,"select public.create_organization('Clinica B','Oradea B') id")).rows[0].id;
  for(const table of ["patients","appointments","doctors","patient_documents","organization_settings"])
   expect((await query(second,`select * from public.${table} where organization_id=$1`,[oid])).rows).toHaveLength(0);
  await expect(query(second,"select public.save_organization_identity($1,$2)",[oid,{name:"Crafted request"}])).rejects.toThrow("Access denied");
  await expect(query(second,"select public.save_core($1,'patients',null,$2)",[cid,{name:"Crafted patient",internal_id:"CROSS"}])).rejects.toThrow("Access denied");
  const secondOrg=(await query<{organization_id:string}>(second,"select organization_id from public.clinics where id=$1",[location])).rows[0].organization_id;
  const draft=setupDraft(location);draft.clinic.email="invalid";
  await query(second,"select public.save_onboarding($1,$2,8,0)",[secondOrg,draft]);
  await expect(query(second,"select public.finish_onboarding($1,1)",[secondOrg])).rejects.toThrow("Invalid clinic identity");
  expect((await query(second,"select * from public.services where organization_id=$1",[secondOrg])).rows).toHaveLength(0);
 });
 it("keeps optional CNP out of lists while checking format, uniqueness and tenant access",async()=>{
  const payload={name:"Pacient identificator test",internal_id:"CNP-TEST",cnp:"1234567890123"};
  const patient=(await query<{id:string}>(fresh,"select public.save_core($1,'patients',null,$2) id",[cid,payload])).rows[0].id;
  const profile=(await query<{result:{cnp:string;created_by:string}}>(fresh,"select public.read_core($1,'patients',$2) result",[cid,patient])).rows[0].result;
  expect(profile.cnp).toBe(payload.cnp);expect(profile.created_by).toBe(fresh);
  const list=(await query<{result:{items:Record<string,unknown>[]}}>(fresh,"select public.list_core($1,'patients') result",[cid])).rows[0].result;
  expect(list.items.every(row=>!("cnp" in row)&&!("administrative_notes" in row))).toBe(true);
  await expect(query(fresh,"select public.save_core($1,'patients',null,$2)",[cid,{...payload,internal_id:"DUPLICATE"}])).rejects.toThrow();
  await expect(query(fresh,"select public.save_core($1,'patients',null,$2)",[cid,{...payload,internal_id:"INVALID",cnp:"not-valid"}])).rejects.toThrow();
  expect((await query(ids.outsider,"select cnp from public.patients where id=$1",[patient])).rows).toHaveLength(0);
  expect(JSON.stringify((await db.query("select metadata from public.audit_logs where entity_id=$1",[patient])).rows)).not.toContain(payload.cnp);
 });
});
