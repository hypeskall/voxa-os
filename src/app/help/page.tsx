import { T } from "@/components/locale-provider";
import Link from "next/link";
export const metadata = { title: "Ajutor și suport" };
const steps = [
  ["Creează și confirmă contul", "Înregistrează-te cu adresa ta de email, deschide mesajul de confirmare și conectează-te. Dacă ai deja o sesiune, poți schimba contul folosind linkul de mai jos."],
  ["Configurează clinica", "Completează configurarea ghidată: organizație, locații, servicii, medici, program de lucru, cabinete și echipă. Progresul poate fi reluat ulterior."],
  ["Pregătește calendarul", "Verifică duratele serviciilor, programul medicilor și resursele necesare înainte de prima programare."],
  ["Adaugă prima programare", "Înregistrează pacientul, apoi alege un interval disponibil din calendar. Confirmarea, mutarea și anularea sunt disponibile în detaliile programării."],
  ["Invită echipa", "Proprietarul sau administratorul clinicii poate invita colegi. Fiecare coleg folosește adresa de email pentru care a fost creată invitația. Medicii trebuie asociați profilului profesional din locație."],
];
export default function Help() {
  const contact=process.env.VOXA_SUPPORT_EMAIL?.trim();
  const email=contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)?contact:null;
  return <main className="standalone" style={{maxWidth:800}}>
    <p className="eyebrow"><T>{"VOXA-OS · AJUTOR"}</T></p><h1><T>{"De la cont la prima programare"}</T></h1>
    <p className="muted"><T>{"Un ghid pentru proprietarul clinicii și echipă."}</T></p>
    <ol>{steps.map(([title,body])=><li key={title} style={{marginTop:24}}><h2>{title}</h2><p>{body}</p></li>)}</ol>
    <section style={{marginTop:32}}><h2><T>{"Cont și acces"}</T></h2><p><T>{"Perioada de testare durează 30 de zile. Datele sunt păstrate după expirare; proprietarul poate consulta pagina Abonament pentru activare."}</T></p>
      <p><Link className="text-link" href="/dashboard"><T>{"Deschide platforma"}</T></Link> · <Link className="text-link" href="/login?switch=1"><T>{"Schimbă contul"}</T></Link> · <Link className="text-link" href="/forgot-password"><T>{"Recuperează parola"}</T></Link></p></section>
    <section style={{marginTop:32}}><h2><T>{"Contactează suportul"}</T></h2><p><T>{"Descrie pașii care au dus la problemă și referința afișată pe pagina de eroare, dacă există. Nu include parole, linkuri de invitație, CNP sau documente medicale în email."}</T></p>
      {email?<a className="text-link" href={`mailto:${email}?subject=Suport%20Voxa-OS`}>{email}</a>:<p className="muted"><T>{"Contactează reprezentantul Voxa pentru asistență."}</T></p>}</section>
    <section style={{marginTop:32}}><h2><T>{"Documente și confidențialitate"}</T></h2><p><Link className="text-link" href="/legal"><T>{"Termeni, confidențialitate, cookies, DPA și reclamații"}</T></Link><T>{". Documentele actuale sunt proiecte pentru revizuire, cu datele firmei încă în curs de finalizare."}</T></p></section>
    <p style={{marginTop:32}}><Link className="text-link" href="/"><T>{"Înapoi la pagina principală"}</T></Link></p>
  </main>;
}
