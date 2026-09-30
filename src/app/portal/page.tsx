import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { portalAppointmentAction, portalLogout } from "@/features/patient-portal/actions";

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
  const parsed = homeSchema.safeParse(data);
  if (error || !parsed.success) return <main className="portal-main"><section className="portal-empty"><h1>Portalul nu este asociat unui pacient</h1><p>Contactați clinica pentru activarea accesului.</p><form action={portalLogout}><Button variant="outline">Deconectare</Button></form></section></main>;
  const home = parsed.data;
  const now = new Date(home.generated_at).getTime();
  const upcoming = home.appointments.filter(a => new Date(a.start_at).getTime() >= now && !["CANCELLED","COMPLETED","NO_SHOW"].includes(a.status));
  const previous = home.appointments.filter(a => !upcoming.includes(a));
  const date = (value:string) => new Intl.DateTimeFormat("ro-RO", { dateStyle:"long", timeStyle:"short", timeZone:home.patient.timezone }).format(new Date(value));
  return <main className="portal-main">
    <header className="portal-welcome"><div><p className="eyebrow">{home.patient.clinic_name}</p><h1>Bună ziua, {home.patient.name}</h1><p className="muted">Cod pacient {home.patient.internal_id}</p></div><form action={portalLogout}><Button variant="outline">Deconectare</Button></form></header>
    <nav className="portal-nav"><a href="#programari">Programări</a><a href="#rezultate">Rezultate</a><a href="#documente">Documente</a><a href="#date">Date personale</a></nav>
    <section id="programari" className="portal-section"><h2>Programări viitoare</h2><div className="portal-list">
      {upcoming.map(a => <article key={a.id}><div><strong>{a.service_name}</strong><span>{date(a.start_at)} · {a.doctor_name || "Medic alocat de clinică"}</span><small>{home.patient.clinic_address}</small></div><div className="portal-row-actions"><ActionForm action={portalAppointmentAction.bind(null,a.id,"confirm")} submit="Confirmă"><></></ActionForm><ActionForm action={portalAppointmentAction.bind(null,a.id,"cancel")} submit="Anulează"><></></ActionForm></div><details><summary>Instrucțiuni pentru vizită</summary><p>{a.instructions || "Nu sunt necesare pregătiri speciale."}</p>{a.required_documents.length > 0 && <ul>{a.required_documents.map(x => <li key={x}>{x}</li>)}</ul>}{a.exclusion_rules.length > 0 && <ul className="warning-box">{a.exclusion_rules.map(x => <li key={x}>{x}</li>)}</ul>}</details></article>)}
      {!upcoming.length && <p className="portal-empty">Nu aveți programări viitoare.</p>}
    </div><details className="portal-history"><summary>Programări anterioare ({previous.length})</summary>{previous.map(a => <p key={a.id}>{date(a.start_at)} · {a.service_name} · {a.status}</p>)}</details></section>
    <section id="rezultate" className="portal-section"><h2>Rezultate disponibile</h2><div className="portal-list">{home.results.map(r => <article key={r.id}><div><strong>{r.title}</strong><span>{r.service_name} · {r.doctor_name}</span></div><Button asChild><a href={`/api/clinics/${home.patient.clinic_id}/results/${r.id}/download`}>Descarcă PDF</a></Button></article>)}{!home.results.length && <p className="portal-empty">Nu există rezultate publicate.</p>}</div></section>
    <section id="documente" className="portal-section"><h2>Documente</h2><div className="portal-list">{home.documents.map(d => <article key={d.id}><div><strong>{d.title}</strong><span>{d.type_name} · {d.file_name}</span></div><Button asChild variant="outline"><a href={`/api/clinics/${home.patient.clinic_id}/documents/${d.id}/download`}>Descarcă</a></Button></article>)}{!home.documents.length && <p className="portal-empty">Nu există documente partajate.</p>}</div></section>
    <section id="date" className="portal-section"><h2>Date personale</h2><dl className="portal-details"><div><dt>Email</dt><dd>{home.patient.email}</dd></div><div><dt>Telefon</dt><dd>{home.patient.phone}</dd></div><div><dt>Adresă</dt><dd>{[home.patient.address,home.patient.city].filter(Boolean).join(", ") || "Necompletată"}</dd></div></dl></section>
  </main>;
}
