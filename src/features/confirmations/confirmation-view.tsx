"use client";
import { useState } from "react";
import { CalendarCheck, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConfirmationDetails } from "./model";

export function ConfirmationView({ token, details }: { token: string; details: ConfirmationDetails }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: "confirm" | "cancel") {
    setBusy(true); setMessage("");
    const response = await fetch("/api/public/confirmation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action }) });
    const result = await response.json() as { error?: string; status?: string };
    setMessage(response.ok ? (action === "confirm" ? "Programarea a fost confirmată." : "Programarea a fost anulată.") : result.error ?? "Acțiunea nu a putut fi finalizată.");
    setBusy(false);
  }
  const date = new Intl.DateTimeFormat("ro-RO", { dateStyle: "full", timeStyle: "short", timeZone: details.timezone }).format(new Date(details.start_at));
  return <main className="confirmation-page">
    <article className="confirmation-card">
      <header><span className="public-mark">V</span><div><p className="eyebrow">{details.clinic_name}</p><h1>Programarea dumneavoastră</h1></div></header>
      <dl className="confirmation-summary">
        <div><dt>Serviciu</dt><dd>{details.service_name}</dd></div>
        <div><dt>Medic</dt><dd>{details.doctor_name || "Va fi alocat de clinică"}</dd></div>
        <div><dt>Data și ora</dt><dd>{date}</dd></div>
        <div><dt>Locație</dt><dd><MapPin size={15}/>{details.address}</dd></div>
        {details.phone && <div><dt>Telefon clinică</dt><dd><Phone size={15}/>{details.phone}</dd></div>}
      </dl>
      {message ? <p className="public-notice" role="status">{message}</p> : <div className="public-actions">
        <Button disabled={busy || details.status === "CONFIRMED"} onClick={() => act("confirm")}><CalendarCheck size={17}/>Confirmă programarea</Button>
        <Button disabled={busy || details.status === "CANCELLED"} variant="outline" onClick={() => act("cancel")}>Anulează programarea</Button>
      </div>}
      <section id="instructiuni" className="instruction-sheet">
        <h2>Instrucțiuni pentru vizită</h2>
        <h3>Pregătire</h3><p>{details.instructions || "Nu sunt necesare pregătiri speciale."}</p>
        <h3>Acte necesare</h3>{details.required_documents.length ? <ul>{details.required_documents.map(x => <li key={x}>{x}</li>)}</ul> : <p>Nu sunt specificate documente suplimentare.</p>}
        {details.exclusion_rules.length > 0 && <><h3>Avertismente</h3><ul>{details.exclusion_rules.map(x => <li key={x}>{x}</li>)}</ul></>}
      </section>
      <footer><ShieldCheck size={15}/>Acest link permite doar gestionarea programării curente și nu oferă acces la portalul pacientului.</footer>
    </article>
  </main>;
}
