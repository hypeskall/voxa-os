import { T } from "@/components/locale-provider";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { portalAppointmentAction, portalLogout } from "@/features/patient-portal/actions";
import { documentSchema } from "@/features/documents/model";
import { appointmentStatusLabels } from "@/lib/locale/ro";

const appointment = z.object({ id:z.uuid(), start_at:z.string(), end_at:z.string(), status:z.string(), service_name:z.string(), doctor_name:z.string().nullable(), instructions:z.string(), required_documents:z.array(z.string()), exclusion_rules:z.array(z.string()) });
const homeSchema = z.object({
  generated_at: z.string(),
  patient: z.object({ id:z.uuid(), clinic_id:z.uuid(), name:z.string(), internal_id:z.string(), birth_date:z.string().nullable(), phone:z.string(), email:z.string(), address:z.string(), city:z.string(), clinic_name:z.string(), clinic_address:z.string(), timezone:z.string() }),
  appointments: z.array(appointment),
  results: z.array(z.object({ id:z.uuid(), title:z.string(), service_name:z.string(), doctor_name:z.string(), status:z.string(), released_at:z.string().nullable() })),
  documents: z.array(z.object({ id:z.uuid(), title:z.string(), type_name:z.string(), file_name:z.string(), created_at:z.string() })),
});

export default async function PortalHome() {
  const client = await db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/portal/login");
  const { data, error } = await client.rpc("patient_portal_home");
  if (error) throw new Error("Portalul pacientului nu a putut fi citit.");
  if (data === null) return <main className="portal-main"><section className="portal-empty"><h1><T>{"Portalul nu este asociat unui pacient"}</T></h1><p><T>{"Contactați clinica pentru activarea accesului."}</T></p><form action={portalLogout}><Button variant="outline"><T>{"Deconectare"}</T></Button></form></section></main>;
  const home = homeSchema.parse(data);
  const { data: uploadData, error: uploadError } = await client.rpc("list_patient_result_uploads", { cid: home.patient.clinic_id, pid: home.patient.id });
  if (uploadError) throw new Error("Rezultatele încărcate nu au putut fi citite.");
  const uploads = z.array(documentSchema).parse(uploadData);
  const uploadIds = new Set(uploads.map(doc => doc.id));
  const documents = home.documents.filter(doc => !uploadIds.has(doc.id));
  const now = new Date(home.generated_at).getTime();
  const upcoming = home.appointments.filter(a => new Date(a.start_at).getTime() >= now && !["CANCELLED","COMPLETED","NO_SHOW"].includes(a.status));
  const previous = home.appointments.filter(a => !upcoming.includes(a));
  const date = (value:string) => new Intl.DateTimeFormat("ro-RO", { dateStyle:"long", timeStyle:"short", timeZone:home.patient.timezone }).format(new Date(value));
  return <main className="portal-main">
    <header className="portal-welcome"><div><p className="eyebrow">{home.patient.clinic_name}</p><h1><T>{"Bună ziua, "}</T>{home.patient.name}</h1><p className="muted"><T>{"Cod pacient "}</T>{home.patient.internal_id}</p></div><form action={portalLogout}><Button variant="outline"><T>{"Deconectare"}</T></Button></form></header>
    <nav className="portal-nav"><a href="#programari"><T>{"Programări"}</T></a><a href="#rezultate"><T>{"Rezultate"}</T></a><a href="#documente"><T>{"Documente"}</T></a><a href="#date"><T>{"Date personale"}</T></a></nav>
    <section id="programari" className="portal-section"><h2><T>{"Programări viitoare"}</T></h2><div className="portal-list">
      {upcoming.map(a => <article key={a.id}><div><strong>{a.service_name}</strong><span>{date(a.start_at)} · {a.doctor_name || "Medic alocat de clinică"}</span><small>{home.patient.clinic_address}</small></div><div className="portal-row-actions"><ActionForm action={portalAppointmentAction.bind(null,a.id,"confirm")} submit="Confirmă"><></></ActionForm><ActionForm action={portalAppointmentAction.bind(null,a.id,"cancel")} submit="Anulează"><></></ActionForm></div><details><summary><T>{"Instrucțiuni pentru vizită"}</T></summary><p>{a.instructions || "Nu sunt necesare pregătiri speciale."}</p>{a.required_documents.length > 0 && <ul>{a.required_documents.map(x => <li key={x}>{x}</li>)}</ul>}{a.exclusion_rules.length > 0 && <ul className="warning-box">{a.exclusion_rules.map(x => <li key={x}>{x}</li>)}</ul>}</details></article>)}
      {!upcoming.length && <p className="portal-empty"><T>{"Nu aveți programări viitoare."}</T></p>}
    </div><details className="portal-history"><summary><T>{"Programări anterioare ("}</T>{previous.length})</summary>{previous.map(a => <p key={a.id}>{date(a.start_at)} · {a.service_name} · <T>{appointmentStatusLabels[a.status] ?? a.status}</T></p>)}</details></section>
    <section id="rezultate" className="portal-section"><h2><T>{"Rezultate disponibile"}</T></h2><div className="portal-list">{home.results.map(r => <article key={r.id}><div><strong>{r.title}</strong><span>{r.service_name} · {r.doctor_name}</span></div><Button asChild><a href={`/api/clinics/${home.patient.clinic_id}/results/${r.id}/download`}><T>{"Descarcă PDF"}</T></a></Button></article>)}{uploads.map(doc => <article key={doc.id}><div><strong>{doc.title}</strong><span>{doc.file_name} · {date(doc.created_at)}</span></div><Button asChild><a href={`/api/clinics/${home.patient.clinic_id}/documents/${doc.id}/download`}><T>{"Descarcă rezultatul"}</T></a></Button></article>)}{!home.results.length && !uploads.length && <p className="portal-empty"><T>{"Nu există rezultate publicate."}</T></p>}</div></section>
    <section id="documente" className="portal-section"><h2><T>{"Documente"}</T></h2><div className="portal-list">{documents.map(d => <article key={d.id}><div><strong>{d.title}</strong><span>{d.type_name} · {d.file_name}</span></div><Button asChild variant="outline"><a href={`/api/clinics/${home.patient.clinic_id}/documents/${d.id}/download`}><T>{"Descarcă"}</T></a></Button></article>)}{!documents.length && <p className="portal-empty"><T>{"Nu există documente partajate."}</T></p>}</div></section>
    <section id="date" className="portal-section"><h2><T>{"Date personale"}</T></h2><dl className="portal-details"><div><dt><T>{"Email"}</T></dt><dd>{home.patient.email}</dd></div><div><dt><T>{"Telefon"}</T></dt><dd>{home.patient.phone}</dd></div><div><dt><T>{"Adresă"}</T></dt><dd>{[home.patient.address,home.patient.city].filter(Boolean).join(", ") || "Necompletată"}</dd></div></dl></section>
  </main>;
}
