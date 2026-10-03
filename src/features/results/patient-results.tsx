import { resultStatusLabels } from "@/features/results/model";
import { medicalResults } from "./data";
import { requireClinic } from "@/features/auth/access";
import { Section, Table } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { formatInTimeZone } from "@/lib/time";
export async function PatientResults({ cid, pid }: { cid: string; pid: string }) {
  const { clinic } = await requireClinic(cid,"results.read"); const results = await medicalResults(cid,pid);
  return <Section title="Rezultate medicale"><Table><thead><tr><th>Rezultat</th><th>Medic</th><th>Stare</th><th>Data</th><th></th></tr></thead><tbody>{results.map(r => <tr key={r.id}><td>{r.title}<small className="table-subtitle">{r.service_name}</small></td><td>{r.doctor_name}</td><td>{resultStatusLabels[r.status]}</td><td>{formatInTimeZone(r.updated_at,clinic.timezone)}</td><td>{r.status === "RELEASED" && <Button asChild size="sm" variant="outline"><a href={`/api/clinics/${cid}/results/${r.id}/download`}>PDF</a></Button>}</td></tr>)}{!results.length && <tr><td colSpan={5} className="table-empty">Nu există rezultate.</td></tr>}</tbody></Table></Section>;
}
