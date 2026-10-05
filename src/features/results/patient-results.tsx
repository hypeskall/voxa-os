import { resultStatusLabels } from "@/features/results/model";
import { medicalResults } from "./data";
import { requireClinic } from "@/features/auth/access";
import { Section, Table } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { Panel } from "@/components/ui/dialog";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { patientResultUploads } from "@/features/documents/data";
import { uploadPatientResult } from "@/features/documents/actions";
import { formatInTimeZone } from "@/lib/time";
export async function PatientResults({ cid, pid }: { cid: string; pid: string }) {
  const { clinic, permissions } = await requireClinic(cid,"results.read");
  const [results, uploads] = await Promise.all([medicalResults(cid,pid), can(permissions,"documents.read") ? patientResultUploads(cid,pid) : []]);
  return <Section title="Rezultate medicale" description="Rapoarte redactate în clinică și rezultate încărcate pentru acest pacient.">
    {can(permissions,"documents.manage") && <div className="mb-5"><Panel drawer title="Încarcă rezultat" description="PDF sau imagine, maximum 3 MB. Verificați pacientul și fișierul înainte de încărcare." trigger={<Button>Încarcă rezultat</Button>}><ActionForm action={uploadPatientResult.bind(null,cid,pid)} submit="Încarcă rezultatul"><Field label="Titlu rezultat"><Input name="title" required maxLength={200}/></Field><Field label="Fișier rezultat"><Input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required/></Field><label className="checkbox-line"><input name="visible_to_patient" type="checkbox" defaultChecked/> Vizibil în portalul pacientului</label></ActionForm></Panel></div>}
    <Table><thead><tr><th>Rezultat</th><th>Medic / sursă</th><th>Stare</th><th>Data</th><th><span className="sr-only">Acțiuni</span></th></tr></thead><tbody>
      {results.map(r => <tr key={r.id}><td><a className="row-link" href={`/clinics/${cid}/results/${r.id}`}>{r.title}</a><small className="table-subtitle">{r.service_name}</small></td><td>{r.doctor_name}</td><td>{resultStatusLabels[r.status]}</td><td>{formatInTimeZone(r.updated_at,clinic.timezone)}</td><td>{r.status === "RELEASED" && <Button asChild size="sm" variant="outline"><a href={`/api/clinics/${cid}/results/${r.id}/download`}>PDF</a></Button>}</td></tr>)}
      {uploads.map(doc => <tr key={doc.id}><td><strong>{doc.title}</strong><small className="table-subtitle">{doc.file_name}</small></td><td>Fișier încărcat</td><td>{doc.visible_to_patient ? "Vizibil în portal" : "Intern"}</td><td>{formatInTimeZone(doc.created_at,clinic.timezone)}</td><td><Button asChild size="sm" variant="outline"><a href={`/api/clinics/${cid}/documents/${doc.id}/download`}>Descarcă</a></Button></td></tr>)}
      {!results.length && !uploads.length && <tr><td colSpan={5} className="table-empty">Nu există rezultate.</td></tr>}
    </tbody></Table>
  </Section>;
}
