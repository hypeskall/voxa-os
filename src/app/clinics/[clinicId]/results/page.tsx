import { T } from "@/components/locale-provider";
import { resultStatusLabels } from "@/features/results/model";
import Link from "next/link";
import { requireClinic } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import { medicalResults, resultOptions } from "@/features/results/data";
import { ResultComposer } from "@/features/results/result-composer";
import { PageHeading, Table } from "@/components/ui/page";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatInTimeZone } from "@/lib/time";

export default async function ResultsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params; const { clinic, permissions } = await requireClinic(clinicId, "results.read");
  const [results, options] = await Promise.all([medicalResults(clinicId), can(permissions,"results.manage") ? resultOptions(clinicId) : []]);
  return <><PageHeading eyebrow={clinic.name} title="Rezultate medicale" description="Redactare, validare și publicare cu istoric de versiuni." action={can(permissions,"results.manage") ? <Panel drawer title="Rezultat nou" description="Rezultatul pornește ca o ciornă asociată medicului programării." trigger={<Button><T>{"Rezultat nou"}</T></Button>}><ResultComposer cid={clinicId} options={options} timeZone={clinic.timezone}/></Panel> : undefined}/>
  <Table><thead><tr><th><T>{"Pacient"}</T></th><th><T>{"Serviciu"}</T></th><th><T>{"Medic"}</T></th><th><T>{"Stare"}</T></th><th><T>{"Actualizat"}</T></th></tr></thead><tbody>{results.map(r => <tr key={r.id}><td><Link className="row-link" href={`/clinics/${clinicId}/results/${r.id}`}>{r.patient_name}</Link><small className="table-subtitle">{r.title}</small></td><td>{r.service_name}</td><td>{r.doctor_name}</td><td><span className={`status result-${r.status.toLowerCase()}`}><T>{resultStatusLabels[r.status]}</T></span></td><td>{formatInTimeZone(r.updated_at, clinic.timezone)}</td></tr>)}{!results.length && <tr><td colSpan={5} className="table-empty"><T>{"Nu există rezultate medicale."}</T></td></tr>}</tbody></Table></>;
}
