import { T } from "@/components/locale-provider";
import { requireClinic } from "@/features/auth/access";
import { PageHeading, Section } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Select } from "@/components/ui/form";
import { reviewPrivacy } from "@/features/privacy/actions";
import { formatInTimeZone } from "@/lib/time";
export const metadata={title:"Solicitări de confidențialitate"};
export default async function PrivacySettings({params}:{params:Promise<{clinicId:string}>}){
 const {clinicId}=await params;const {client,clinic}=await requireClinic(clinicId,"organization.manage");
 const {data,error}=await client.from("privacy_requests").select("id,patient_id,request_type,status,reason,review_note,created_at").eq("clinic_id",clinicId).order("created_at",{ascending:false}).limit(50);
 if(error)throw new Error("Solicitările nu au putut fi încărcate.");
 const labels={pending_review:"În analiză",approved:"Aprobată",rejected:"Respinsă",completed:"Procesare confirmată"};
 return <><PageHeading eyebrow="SETĂRI" title="Solicitări de confidențialitate" description="Analiză documentată, fără ștergerea automată a istoricului clinic."/><Section title="Solicitări recente" description="După aprobarea unei solicitări, persoana responsabilă execută procesul de retenție și curățare documentat. Finalizarea de mai jos înregistrează confirmarea acelui proces; nu șterge fișiere.">{data.map(r=><article key={r.id} className="setup-record"><h3><T>{r.request_type==="anonymization"?"Anonimizare":"Ștergere"}</T> · <T>{labels[r.status]}</T></h3><small>{formatInTimeZone(r.created_at,clinic.timezone)}</small><p>{r.reason}</p>{r.review_note&&<p>{r.review_note}</p>}{["pending_review","approved"].includes(r.status)&&<ActionForm action={reviewPrivacy.bind(null,clinicId,r.id)} submit="Înregistrează decizia"><Field label="Decizie"><Select name="decision">{r.status==="pending_review"?<><option value="approved"><T>{"Aprobă procesarea"}</T></option><option value="rejected"><T>{"Respinge solicitarea"}</T></option></>:<option value="completed"><T>{"Confirmă procesarea efectuată"}</T></option>}</Select></Field><Field label="Justificare și proces efectuat"><textarea name="review" className="input textarea" required minLength={10} maxLength={2000}/></Field></ActionForm>}</article>)}{!data.length&&<p className="muted"><T>{"Nu există solicitări."}</T></p>}</Section></>;
}
