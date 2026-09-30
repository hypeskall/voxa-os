import { requireClinic } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import { ActionForm } from "@/components/ui/action-form";
import { Section } from "@/components/ui/page";
import { activatePatientPortal } from "./actions";
export async function ActivatePatientPortal({cid,pid}:{cid:string;pid:string}){const {client,permissions}=await requireClinic(cid,"patients.read");const {data}=await client.from("patient_identities").select("id,verified_at").eq("clinic_id",cid).eq("patient_id",pid).is("revoked_at",null).maybeSingle();return <Section title="Portal pacient" description="Cont separat, fără drepturi de personal.">{data?<p className="message success">Portal activat pentru acest pacient.</p>:can(permissions,"patients.manage")?<ActionForm action={activatePatientPortal.bind(null,cid,pid)} submit="Activează și trimite invitația"><p className="muted">Invitația Supabase va fi trimisă la adresa de email din profil.</p></ActionForm>:<p className="muted">Portalul nu este activat.</p>}</Section>}
