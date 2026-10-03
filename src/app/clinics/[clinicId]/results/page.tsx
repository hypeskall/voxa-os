import { resultStatusLabels } from "@/features/results/model";
import Link from "next/link";
import { requireClinic } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import { medicalResults, resultOptions } from "@/features/results/data";
import { saveResult } from "@/features/results/actions";
import { PageHeading, Table } from "@/components/ui/page";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { formatInTimeZone } from "@/lib/time";

export default async function ResultsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params; const { clinic, permissions } = await requireClinic(clinicId, "results.read");
  const [results, options] = await Promise.all([medicalResults(clinicId), can(permissions,"results.manage") ? resultOptions(clinicId) : []]);
  return <><PageHeading eyebrow={clinic.name} title="Rezultate medicale" description="Redactare, validare și publicare cu istoric de versiuni." action={can(permissions,"results.manage") ? <Panel drawer title="Rezultat nou" description="Rezultatul pornește în starea draft." trigger={<Button>Rezultat nou</Button>}><ActionForm action={saveResult.bind(null, clinicId, null)} submit="Creează draft"><Field label="Programare"><Select name="appointment_id" required><option value="">Selectați</option>{options.map(o => <option key={o.id} value={o.id}>{o.patient_name} · {o.service_name} · {formatInTimeZone(o.start_at, clinic.timezone)}</option>)}</Select></Field><Field label="Medic"><Select name="doctor_id" required>{options.map(o => <option key={o.id} value={o.doctor_id}>{o.doctor_name}</option>)}</Select></Field><Field label="Titlu"><Input name="title" required defaultValue="Rezultat medical"/></Field><Field label="Conținut"><textarea className="input textarea result-editor" name="content" required/></Field></ActionForm></Panel> : undefined}/>
  <Table><thead><tr><th>Pacient</th><th>Serviciu</th><th>Medic</th><th>Stare</th><th>Actualizat</th></tr></thead><tbody>{results.map(r => <tr key={r.id}><td><Link className="row-link" href={`/clinics/${clinicId}/results/${r.id}`}>{r.patient_name}</Link><small className="table-subtitle">{r.title}</small></td><td>{r.service_name}</td><td>{r.doctor_name}</td><td><span className={`status result-${r.status.toLowerCase()}`}>{resultStatusLabels[r.status]}</span></td><td>{formatInTimeZone(r.updated_at, clinic.timezone)}</td></tr>)}{!results.length && <tr><td colSpan={5} className="table-empty">Nu există rezultate medicale.</td></tr>}</tbody></Table></>;
}
