import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { Section } from "@/components/ui/page";
import { requestPrivacy } from "./actions";
export function PatientPrivacy({ cid, pid }: { cid: string; pid: string }) {
  return <Section title="Date personale" description="Exportul și solicitările sunt înregistrate în audit."><Link className="text-link" href={`/api/clinics/${cid}/patients/${pid}/export`}>Descarcă exportul pacientului (JSON)</Link><p className="muted">Fișierele originale se descarcă separat din Documente. Pentru ștergere sau anonimizare, înregistrați o solicitare; analiza include retenția documentelor, rezultatelor și copiilor de siguranță.</p><ActionForm action={requestPrivacy.bind(null,cid,pid)} submit="Înregistrează solicitarea"><Field label="Tip solicitare"><Select name="kind"><option value="anonymization">Anonimizare</option><option value="erasure">Ștergere</option></Select></Field><Field label="Motiv solicitare"><Input name="reason" required minLength={10} maxLength={2000}/></Field></ActionForm></Section>;
}
