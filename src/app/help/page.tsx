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
    <p className="eyebrow">VOXA-OS · AJUTOR</p><h1>De la cont la prima programare</h1>
    <p className="muted">Un ghid pentru proprietarul clinicii și echipă.</p>
    <ol>{steps.map(([title,body])=><li key={title} style={{marginTop:24}}><h2>{title}</h2><p>{body}</p></li>)}</ol>
    <section style={{marginTop:32}}><h2>Cont și acces</h2><p>Perioada de testare durează 30 de zile. Datele sunt păstrate după expirare; proprietarul poate consulta pagina Abonament pentru activare.</p>
      <p><Link className="text-link" href="/dashboard">Deschide platforma</Link> · <Link className="text-link" href="/login?switch=1">Schimbă contul</Link> · <Link className="text-link" href="/forgot-password">Recuperează parola</Link></p></section>
    <section style={{marginTop:32}}><h2>Contactează suportul</h2><p>Descrie pașii care au dus la problemă și referința afișată pe pagina de eroare, dacă există. Nu include parole, linkuri de invitație, CNP sau documente medicale în email.</p>
      {email?<a className="text-link" href={`mailto:${email}?subject=Suport%20Voxa-OS`}>{email}</a>:<p className="muted">Contactează reprezentantul Voxa pentru asistență.</p>}</section>
    <p style={{marginTop:32}}><Link className="text-link" href="/">Înapoi la pagina principală</Link></p>
  </main>;
}
