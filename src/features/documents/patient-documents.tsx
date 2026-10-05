import { T } from "@/components/locale-provider";
import { can } from "@/lib/permissions";
import { requireClinic } from "@/features/auth/access";
import { patientDocuments } from "./data";
import { uploadPatientDocument } from "./actions";
import { Section, Table } from "@/components/ui/page";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { formatInTimeZone } from "@/lib/time";

export async function PatientDocuments({ cid, pid }: { cid: string; pid: string }) {
  const { permissions, clinic } = await requireClinic(cid, "documents.read");
  const { documents, types } = await patientDocuments(cid, pid);
  return <Section title="Documente pacient" description="Fișiere private, accesibile doar după autorizare pe server.">
    {can(permissions, "documents.manage") && <div className="mb-5"><Panel title="Încarcă document" description="PDF sau imagine, maximum 3 MB." trigger={<Button><T>{"Încarcă document"}</T></Button>}><ActionForm action={uploadPatientDocument.bind(null, cid, pid)} submit="Încarcă"><Field label="Titlu"><Input name="title" required/></Field><Field label="Tip document"><Select name="document_type_id">{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field><Field label="Fișier"><Input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required/></Field><label className="checkbox-line"><input name="visible_to_patient" type="checkbox"/><T>{" Vizibil în portalul pacientului"}</T></label></ActionForm></Panel></div>}
    <Table><thead><tr><th><T>{"Document"}</T></th><th><T>{"Tip"}</T></th><th><T>{"Data"}</T></th><th><T>{"Portal"}</T></th><th></th></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td><strong>{doc.title}</strong><small className="table-subtitle">{doc.file_name} · {(doc.file_size/1024).toFixed(0)}<T>{" KB"}</T></small></td><td>{doc.type_name}</td><td>{formatInTimeZone(doc.created_at, clinic.timezone)}</td><td>{doc.visible_to_patient ? "Da" : "Nu"}</td><td><Button asChild variant="outline" size="sm"><a href={`/api/clinics/${cid}/documents/${doc.id}/download`}><T>{"Descarcă"}</T></a></Button></td></tr>)}{!documents.length && <tr><td colSpan={5} className="table-empty"><T>{"Nu există documente încărcate."}</T></td></tr>}</tbody></Table>
  </Section>;
}
