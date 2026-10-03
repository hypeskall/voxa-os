import Link from "next/link";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { PageHeading, Table } from "@/components/ui/page";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { localDate } from "@/lib/time";
import { appointmentStatusLabels } from "@/lib/locale/ro";
export const metadata = { title: "Programul meu" };
export default async function MySchedule({ params, searchParams }: { params: Promise<{ clinicId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { clinicId } = await params; const { client, clinic } = await requireClinic(clinicId, "results.manage");
  const search = await searchParams;
  const date = z.iso.date().safeParse(search.date ?? localDate(clinic.timezone));
  const day = date.success ? date.data : localDate(clinic.timezone);
  const { data, error } = await client.rpc("my_doctor_schedule", { cid: clinicId, day_from: day, day_to: day });
  if (error) throw new Error("Programul personal nu a putut fi încărcat.");
  const appointments = z.array(z.object({ id: z.uuid(), start_at: z.string(), end_at: z.string(), patient_id: z.uuid(), patient_name: z.string(), service_name: z.string(), status: z.enum(["PENDING","CONFIRMED","ARRIVED","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW"]) })).parse(data);
  const time = (instant: string) => new Intl.DateTimeFormat("ro-RO", { timeZone: clinic.timezone, timeStyle: "short" }).format(new Date(instant));
  return <><PageHeading eyebrow="ACTIVITATE CLINICĂ" title="Programul meu" description="Numai programările asociate contului dumneavoastră de medic."/><form className="toolbar"><Field label="Data"><Input type="date" name="date" defaultValue={day}/></Field><Button variant="outline">Afișează programul</Button></form><Table><thead><tr><th>Ora</th><th>Pacient</th><th>Serviciu</th><th>Stare</th></tr></thead><tbody>{appointments.map((a) => <tr key={a.id}><td>{time(a.start_at)}–{time(a.end_at)}</td><td><Link className="text-link" href={`/clinics/${clinicId}/clinical-patients/${a.patient_id}`}>{a.patient_name}</Link></td><td>{a.service_name}</td><td>{appointmentStatusLabels[a.status]}</td></tr>)}{!appointments.length && <tr><td colSpan={4}>Nu aveți programări în această zi. Dacă programul nu este asociat contului, solicitați administratorului configurarea în profilul medicului.</td></tr>}</tbody></Table></>;
}
