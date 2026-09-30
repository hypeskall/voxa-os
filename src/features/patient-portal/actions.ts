"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/auth/actions";
import { db } from "@/lib/supabase/server";
import { requireClinic } from "@/features/auth/access";
import { adminDb, hasAdminConfig } from "@/lib/supabase/admin";

export async function requestPortalLink(state:ActionState, form:FormData):Promise<ActionState> {
  void state;
  const email=z.email().safeParse(form.get("email"));
  if(!email.success)return{error:"Introduceți o adresă de email validă."};
  const client=await db(); const h=await headers();
  const origin=process.env.APP_ORIGIN??`http${process.env.NODE_ENV==="production"?"s":""}://${h.get("host")}`;
  const {error}=await client.auth.signInWithOtp({email:email.data,options:{shouldCreateUser:false,emailRedirectTo:`${origin}/auth/callback?next=/portal`}});
  if(error)return{error:"Linkul nu a putut fi trimis. Verificați dacă portalul a fost activat de clinică."};
  return{success:"Dacă există un cont activ, veți primi în câteva minute un link securizat de autentificare."};
}
export async function portalAppointmentAction(aid:string,action:"confirm"|"cancel",state:ActionState,form:FormData):Promise<ActionState> {
  void state; void form; const client=await db(); const parsed=z.uuid().safeParse(aid);
  if(!parsed.success)return{error:"Programarea nu este validă."};
  const {error}=await client.rpc("patient_portal_appointment_action",{aid:parsed.data,action_value:action});
  if(error)return{error:action==="cancel"?"Programarea nu mai poate fi anulată online. Contactați clinica.":"Programarea nu a putut fi confirmată."};
  revalidatePath("/portal"); return{success:action==="confirm"?"Programarea a fost confirmată.":"Programarea a fost anulată."};
}
export async function portalLogout(){const client=await db();await client.auth.signOut();redirect("/portal/login");}
export async function activatePatientPortal(cid:string,pid:string,state:ActionState,form:FormData):Promise<ActionState> {
  void state; void form; const {client}=await requireClinic(cid,"patients.manage");
  if(!hasAdminConfig())return{error:"Cheia server Supabase necesară activării portalului nu este configurată."};
  const {data:raw,error:patientError}=await client.rpc("read_core",{cid,module:"patients",entity_id:pid});
  const parsed=z.object({email:z.email()}).safeParse(raw);
  if(patientError||!parsed.success)return{error:"Pacientul are nevoie de o adresă de email validă."};
  const email=parsed.data.email; let {data:userId}=await client.rpc("lookup_patient_auth_user",{cid,pid});
  if(!userId){const origin=process.env.APP_ORIGIN;const {data,error}=await adminDb().auth.admin.inviteUserByEmail(email,{redirectTo:origin?`${origin}/auth/callback?next=/portal`:undefined});if(error||!data.user)return{error:"Invitația nu a putut fi trimisă."};userId=data.user.id;}
  const {error}=await client.rpc("link_patient_identity",{cid,pid,uid:userId});
  if(error)return{error:"Identitatea pacientului nu a putut fi asociată."};
  revalidatePath(`/clinics/${cid}/patients/${pid}`);return{success:"Portalul a fost activat. Pacientul poate folosi autentificarea prin link securizat."};
}
