import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
const config=stagingEnv();
const actors=JSON.parse(fs.readFileSync(".staging-actors.local.json","utf8"));
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}};
async function login(page:Page,actor:{email:string;password:string}){
 await page.goto("/login");await expect(page.locator("form")).toHaveAttribute("method","post");await page.getByLabel("Utilizator").fill(actor.email);await page.getByLabel("Parolă",{exact:true}).fill(actor.password);await page.getByRole("button",{name:"Conectare",exact:true}).click();await expect(page).not.toHaveURL(/\/login/);
}
test("hosted invitations, role boundaries, doctor schedule and organization switching",async({page,context,request})=>{
 test.setTimeout(180000);
 page.setDefaultTimeout(10000);
 const headers:Record<string,string>=config.env.STAGING_PREVIEW_BYPASS_SECRET?{"x-vercel-protection-bypass":config.env.STAGING_PREVIEW_BYPASS_SECRET}:{};
 if(config.env.STAGING_PREVIEW_BYPASS_SECRET)await context.route(`${config.origin}/**`,route=>route.continue({headers:{...route.request().headers(),...headers}}));
 await expect.poll(async()=>{const response=await request.get("/api/staging/status",{headers,maxRedirects:0});if(response.status()!==200||!response.headers()["content-type"]?.includes("application/json"))return false;const m=await response.json();return m.environment==="staging"&&m.supabaseProjectRef===config.ref&&m.origin===config.origin;},{timeout:30000}).toBe(true);
 const a=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,options),b=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,options);
 const admin=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const aLogin=await a.auth.signInWithPassword(actors.a),bLogin=await b.auth.signInWithPassword(actors.b);
 expect(Boolean(aLogin.error||bLogin.error),"Both normal password logins must succeed").toBe(false);
 const uid=bLogin.data.user!.id;
 const original=await admin.from("clinic_memberships").select("id").eq("clinic_id",actors.a.clinicId).eq("user_id",uid);
 expect(original.error).toBeNull();expect(original.data?.length,"Refuse to change a pre-existing cross-clinic membership").toBe(0);
 const originalOrg=await admin.from("organization_members").select("id").eq("organization_id",actors.a.organizationId).eq("user_id",uid);
 expect(originalOrg.error).toBeNull();expect(originalOrg.data?.length).toBe(0);
 const inviteIds:string[]=[];let did:string|undefined;let oldStaff:string|null=null;let linked=false;
 const invite=async()=>{
   const token=randomBytes(32).toString("base64url"),digest=createHash("sha256").update(token).digest("hex");
   const result=await a.rpc("create_staff_invite",{cid:actors.a.clinicId,target_email:actors.b.email,target_role:"RECEPTION",digest});
   expect(result.error).toBeNull();inviteIds.push(result.data);return {id:result.data,digest};
 };
 const denied=async(result:PromiseLike<{error:unknown}>)=>expect(Boolean((await result).error)).toBe(true);
 try{
   console.log("Hosted roles: negative invitation cases");
   await denied(b.rpc("accept_staff_invite",{digest:createHash("sha256").update("nonexistent-invite").digest("hex")}));
   const revoked=await invite();await denied(a.rpc("accept_staff_invite",{digest:revoked.digest}));
   expect((await a.rpc("revoke_staff_invite",{iid:revoked.id})).error).toBeNull();await denied(b.rpc("accept_staff_invite",{digest:revoked.digest}));
   const expired=await invite();const expiry=await admin.from("organization_invites").update({expires_at:new Date(Date.now()-60000).toISOString()}).eq("id",expired.id).eq("clinic_id",actors.a.clinicId).eq("email",actors.b.email).select("id");
   expect(expiry.error).toBeNull();expect(expiry.data?.length).toBe(1);await denied(b.rpc("accept_staff_invite",{digest:expired.digest}));
   await login(page,actors.a);await page.goto(`/clinics/${actors.a.clinicId}/team`);
   console.log("Hosted roles: owner UI creates an invitation");
   await page.getByLabel("Email coleg",{exact:true}).fill(actors.b.email);await page.getByRole("combobox",{name:"Rol coleg",exact:true}).selectOption("RECEPTION");await page.getByRole("button",{name:"Creează invitația",exact:true}).click();
   const field=page.getByLabel("Link de invitație · valabil 7 zile");await expect(field).toBeVisible();
   const url=await field.inputValue();const token=new URL(url).pathname.split("/").pop()!;
   expect(new URL(url).origin===config.origin&&/^[A-Za-z0-9_-]{43}$/.test(token)).toBe(true);
   const digest=createHash("sha256").update(token).digest("hex");
   const saved=await a.from("organization_invites").select("id,role,expires_at,accepted_at").eq("clinic_id",actors.a.clinicId).eq("email",actors.b.email).is("revoked_at",null).is("accepted_at",null);
   expect(saved.error).toBeNull();expect(saved.data?.length).toBe(1);inviteIds.push(saved.data![0].id);expect(new Date(saved.data![0].expires_at).getTime()).toBeGreaterThan(Date.now()+6*86400000);
   await page.goto(url);await page.getByRole("button",{name:"Acceptă invitația",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"destinată altei adrese"})).toBeVisible();
   console.log("Hosted roles: recipient login and acceptance");
   await page.goto(`/clinics/${actors.a.clinicId}`);await page.getByRole("button",{name:"Deconectare",exact:true}).click();await expect(page).toHaveURL(/\/login/);
   await page.goto(url);await page.getByRole("link",{name:"Conectează-te pentru a accepta"}).click();await page.getByLabel("Utilizator").fill(actors.b.email);await page.getByLabel("Parolă",{exact:true}).fill(actors.b.password);await page.getByRole("button",{name:"Conectare",exact:true}).click();await expect(page.getByRole("button",{name:"Acceptă invitația",exact:true})).toBeVisible();
   await page.getByRole("button",{name:"Acceptă invitația",exact:true}).click();await expect(page).toHaveURL(`${config.origin}/clinics/${actors.a.clinicId}`);
   await expect(page.getByRole("heading",{name:"Spațiul de lucru",exact:true})).toBeVisible();
   await denied(b.rpc("accept_staff_invite",{digest}));
   const membership=await a.from("clinic_memberships").select("role,active").eq("clinic_id",actors.a.clinicId).eq("user_id",uid);expect(membership.data).toEqual([{role:"RECEPTION",active:true}]);
   const reception=await b.rpc("my_permissions",{cid:actors.a.clinicId});expect(reception.data).toContain("patients.manage");expect(reception.data).not.toContain("members.manage");
   console.log("Hosted roles: reception boundaries");
   await denied(b.rpc("set_membership",{cid:actors.a.clinicId,target_email:actors.a.email,target_role:"DOCTOR",is_active:true}));
   for(const route of ["team","audit","settings/organization","settings/privacy"]){await page.goto(`/clinics/${actors.a.clinicId}/${route}`);await expect(page.getByRole("heading",{name:"Pagina nu este disponibilă",exact:true})).toBeVisible();}
   await page.goto(`/clinics/${actors.a.clinicId}/patients/${actors.a.patientId}`);await expect(page.locator(".app-shell")).toBeVisible();
   expect((await a.rpc("set_membership",{cid:actors.a.clinicId,target_email:actors.b.email,target_role:"ADMIN",is_active:true})).error).toBeNull();
   const adminPermissions=await b.rpc("my_permissions",{cid:actors.a.clinicId});expect(adminPermissions.data).toContain("members.manage");expect(adminPermissions.data).not.toContain("organization.manage");
   console.log("Hosted roles: administrator boundaries");
   await denied(b.rpc("set_membership",{cid:actors.a.clinicId,target_email:actors.a.email,target_role:"RECEPTION",is_active:true}));
   await denied(b.rpc("save_organization_identity",{oid:actors.a.organizationId,payload:{name:"Forbidden synthetic change"}}));
   await page.goto(`/clinics/${actors.a.clinicId}/team`);await expect(page.getByRole("heading",{name:"Echipă și acces",exact:true})).toBeVisible();
   await page.goto(`/clinics/${actors.a.clinicId}/settings/organization`);await expect(page.getByRole("heading",{name:"Pagina nu este disponibilă",exact:true})).toBeVisible();
   expect((await a.rpc("set_membership",{cid:actors.a.clinicId,target_email:actors.b.email,target_role:"DOCTOR",is_active:true})).error).toBeNull();
   console.log("Hosted roles: doctor workflow and organization switching");
   const appointment=await a.from("appointments").select("doctor_location_id").eq("id",actors.a.appointmentId).single();expect(appointment.error).toBeNull();did=appointment.data!.doctor_location_id;
   const affiliation=await admin.from("doctor_locations").select("staff_user_id").eq("id",did!).eq("clinic_id",actors.a.clinicId).single();expect(affiliation.error).toBeNull();oldStaff=affiliation.data!.staff_user_id;expect(oldStaff,"Test affiliation must initially be unassigned").toBeNull();
   // Link only the existing synthetic doctor; restore the field in finally.
   const link=await admin.from("doctor_locations").update({staff_user_id:uid}).eq("id",did!).eq("clinic_id",actors.a.clinicId).is("staff_user_id",null).select("id");expect(link.error).toBeNull();expect(link.data?.length).toBe(1);linked=true;
   const schedule=await b.rpc("my_doctor_schedule",{cid:actors.a.clinicId,day_from:"2026-10-05",day_to:"2026-10-07"});expect(schedule.error).toBeNull();expect(schedule.data.map((row:{id:string})=>row.id)).toContain(actors.a.appointmentId);
   const all=await a.from("appointments").select("id,doctor_location_id").eq("clinic_id",actors.a.clinicId);expect(all.error).toBeNull();const otherDoctor=all.data!.find(row=>row.doctor_location_id!==did);expect(Boolean(otherDoctor)).toBe(true);expect(schedule.data.map((row:{id:string})=>row.id)).not.toContain(otherDoctor!.id);
   const general=await b.from("patients").select("id").eq("clinic_id",actors.a.clinicId);expect(general.error).toBeNull();expect(general.data).toEqual([]);
   await denied(b.rpc("update_appointment_notes",{cid:actors.a.clinicId,aid:actors.a.appointmentId,new_notes:"Forbidden synthetic note",expected_updated_at:new Date().toISOString()}));
   await denied(b.rpc("set_doctor_credentials",{cid:actors.a.clinicId,did:otherDoctor!.doctor_location_id,staff_uid:uid,signature_path:null,signature_type:null,stamp_path:null,stamp_type:null}));
   await page.goto(`/clinics/${actors.a.clinicId}/my-schedule?date=2026-10-05`);await expect(page.getByRole("heading",{name:"Programul meu",exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Ion Popescu",exact:true})).toBeVisible();
   const nav=page.getByRole("navigation",{name:"Navigație principală"});await expect(nav.getByRole("link",{name:"Calendar",exact:true})).toHaveCount(0);await expect(nav.getByRole("link",{name:"Pacienți",exact:true})).toHaveCount(0);
   for(const route of ["patients","audit","settings/privacy"]){await page.goto(`/clinics/${actors.a.clinicId}/${route}`);await expect(page.getByRole("heading",{name:"Pagina nu este disponibilă",exact:true})).toBeVisible();}
   await page.goto(`/clinics/${actors.b.clinicId}`);await expect(page.getByRole("heading",{name:"Spațiul de lucru",exact:true})).toBeVisible();
   expect((await b.rpc("my_permissions",{cid:actors.b.clinicId})).data).toContain("organization.manage");
   await page.goto(`/clinics/${actors.b.clinicId}/patients/${actors.b.patientId}`);await expect(page.locator(".app-shell")).toBeVisible();
   await page.goto(`/clinics/${actors.a.clinicId}/my-schedule?date=2026-10-05`);await expect(page.getByRole("heading",{name:"Programul meu",exact:true})).toBeVisible();
   expect((await a.rpc("set_membership",{cid:actors.a.clinicId,target_email:actors.b.email,target_role:"DOCTOR",is_active:false})).error).toBeNull();await denied(b.rpc("my_doctor_schedule",{cid:actors.a.clinicId,day_from:"2026-10-05",day_to:"2026-10-05"}));
   await page.reload();await expect(page.getByRole("heading",{name:"Pagina nu este disponibilă",exact:true})).toBeVisible();
 }finally{
   console.log("Hosted roles: restore disposable grants and associations");
   if(linked){const reset=await admin.from("doctor_locations").update({staff_user_id:oldStaff}).eq("id",did!).eq("clinic_id",actors.a.clinicId).eq("staff_user_id",uid);expect(reset.error).toBeNull();}
   // This pair was absent at the start; only the disposable test grant is removed.
   const clean=await admin.from("clinic_memberships").delete().eq("clinic_id",actors.a.clinicId).eq("user_id",uid);expect(clean.error).toBeNull();
   const projection=await admin.from("organization_members").delete().eq("organization_id",actors.a.organizationId).eq("user_id",uid);expect(projection.error).toBeNull();
   for(const iid of inviteIds)await a.rpc("revoke_staff_invite",{iid});
   await a.auth.signOut({scope:"local"});await b.auth.signOut({scope:"local"});
 }
});
