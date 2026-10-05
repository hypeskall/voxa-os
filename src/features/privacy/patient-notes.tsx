import { T } from "@/components/locale-provider";
import { requireClinic } from "@/features/auth/access";
import { ActionForm } from "@/components/ui/action-form";
import { Field } from "@/components/ui/form";
import { Section } from "@/components/ui/page";
import { can } from "@/lib/permissions";
import { formatInTimeZone } from "@/lib/time";
import { addNote } from "./actions";
export async function PatientNotes({ cid, pid }: { cid: string; pid: string }) {
  const { client, clinic, permissions } = await requireClinic(cid);
  const { data, error } = await client.from("patient_notes").select("id,content,created_at").eq("clinic_id", cid).eq("patient_id", pid).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Notele nu au putut fi încărcate.");
  return <Section title="Note pacient" description="Note interne, cu autor și dată păstrate în baza de date.">{data.map((note) => <article key={note.id} className="setup-record"><small>{formatInTimeZone(note.created_at, clinic.timezone)}</small><p className="whitespace-pre-wrap">{note.content}</p></article>)}{!data.length && <p className="muted"><T>{"Nu există note."}</T></p>}{(can(permissions,"patients.manage") || can(permissions,"results.manage")) && <ActionForm action={addNote.bind(null,cid,pid)} submit="Adaugă nota"><Field label="Conținut notă"><textarea className="input textarea" name="content" required maxLength={10000} rows={4}/></Field></ActionForm>}</Section>;
}
