import { Download } from "lucide-react";
import { PageHeading, Section, Table } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { requireClinic } from "@/features/auth/access";
import { optionsFor } from "@/features/core-clinic/data";
import { loadReport, reportFiltersSchema } from "@/features/reports/data";

export const metadata = { title: "Rapoarte" };
const statusLabels: Record<string,string> = { PENDING:"În așteptare", CONFIRMED:"Confirmate", ARRIVED:"Sosite", IN_PROGRESS:"În desfășurare", COMPLETED:"Finalizate", CANCELLED:"Anulate", NO_SHOW:"Neprezentări" };
const sourceLabels: Record<string,string> = { RECEPTION:"Recepție", WEBSITE:"Website", PATIENT_PORTAL:"Portal pacient", API:"API", VOICE_AGENT:"Agent vocal" };

function isoDate(date: Date) { return date.toISOString().slice(0,10); }

export default async function Reports({ params, searchParams }: { params: Promise<{clinicId:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { clinicId } = await params;
  await requireClinic(clinicId,"reports.read");
  const raw = await searchParams;
  const today = new Date(); const start = new Date(today); start.setUTCDate(start.getUTCDate()-29);
  const candidate = { from: typeof raw.from==="string"?raw.from:isoDate(start), to: typeof raw.to==="string"?raw.to:isoDate(today), doctor: typeof raw.doctor==="string"&&raw.doctor?raw.doctor:undefined, service: typeof raw.service==="string"&&raw.service?raw.service:undefined };
  const parsed = reportFiltersSchema.safeParse(candidate);
  const filters = parsed.success ? parsed.data : { from: isoDate(start), to: isoDate(today) };
  const [report, doctors, services] = await Promise.all([loadReport(clinicId,filters),optionsFor(clinicId,"doctors"),optionsFor(clinicId,"services")]);
  const exportQuery = new URLSearchParams({ from: filters.from, to: filters.to, ...(filters.doctor?{doctor:filters.doctor}:{}), ...(filters.service?{service:filters.service}:{}) });
  return <>
    <PageHeading eyebrow="OPERAȚIUNI" title="Rapoarte" description="Indicatori calculați server-side din programările locației curente." action={<Button asChild variant="outline"><a href={`/api/clinics/${clinicId}/reports/export?${exportQuery}`}><Download size={15}/>Exportă CSV</a></Button>} />
    <form className="report-filters" method="get">
      <Field label="De la"><Input type="date" name="from" defaultValue={filters.from}/></Field>
      <Field label="Până la"><Input type="date" name="to" defaultValue={filters.to}/></Field>
      <Field label="Medic"><Select name="doctor" defaultValue={filters.doctor??""}><option value="">Toți medicii</option>{doctors.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
      <Field label="Serviciu"><Select name="service" defaultValue={filters.service??""}><option value="">Toate serviciile</option>{services.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
      <Button type="submit">Aplică filtrele</Button>
    </form>
    {!parsed.success && <p className="message error" role="alert">Perioada sau filtrele primite nu sunt valide. Este afișată perioada implicită.</p>}
    <div className="metric-strip report-metrics"><div><span>Programări</span><strong>{report.summary.total}</strong></div><div><span>Finalizate</span><strong>{report.summary.completed}</strong></div><div><span>Anulate</span><strong>{report.summary.cancelled}</strong></div><div><span>Neprezentări</span><strong>{report.summary.no_show}</strong></div><div><span>Ocupare program</span><strong>{report.summary.occupancy_percent==null?"—":`${report.summary.occupancy_percent}%`}</strong></div></div>
    <div className="report-grid">
      <Section title="Pe medic" description="Volumul de programări din perioada selectată."><Table><thead><tr><th>Medic</th><th>Programări</th></tr></thead><tbody>{report.by_doctor.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.count}</td></tr>)}{!report.by_doctor.length&&<tr><td colSpan={2} className="table-empty">Nu există date.</td></tr>}</tbody></Table></Section>
      <Section title="Pe serviciu" description="Serviciile solicitate în perioada selectată."><Table><thead><tr><th>Serviciu</th><th>Programări</th></tr></thead><tbody>{report.by_service.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.count}</td></tr>)}{!report.by_service.length&&<tr><td colSpan={2} className="table-empty">Nu există date.</td></tr>}</tbody></Table></Section>
      <Section title="Status și sursă"><div className="report-split"><Table><thead><tr><th>Status</th><th>Total</th></tr></thead><tbody>{report.by_status.map(r=><tr key={r.label}><td>{statusLabels[r.label]??r.label}</td><td>{r.count}</td></tr>)}</tbody></Table><Table><thead><tr><th>Sursă</th><th>Total</th></tr></thead><tbody>{report.by_source.map(r=><tr key={r.label}><td>{sourceLabels[r.label]??r.label}</td><td>{r.count}</td></tr>)}</tbody></Table></div></Section>
      <Section title="Utilizarea resurselor" description="Minute ocupate, calculate din intervalele cu buffere."><Table><thead><tr><th>Tip</th><th>Resursă</th><th>Programări</th><th>Minute ocupate</th></tr></thead><tbody>{report.resources.map(r=><tr key={`${r.kind}-${r.name}`}><td>{r.kind==="room"?"Cabinet":"Echipament"}</td><td>{r.name}</td><td>{r.appointment_count}</td><td>{r.booked_minutes}</td></tr>)}{!report.resources.length&&<tr><td colSpan={4} className="table-empty">Nu există resurse utilizate în această perioadă.</td></tr>}</tbody></Table></Section>
    </div>
  </>;
}
