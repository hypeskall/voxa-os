import { T } from "@/components/locale-provider";
import { resultStatusLabels } from "@/features/results/model";
import Link from "next/link";
import { requireClinic } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import { medicalResult } from "@/features/results/data";
import { saveResult, validateResult, releaseResult } from "@/features/results/actions";
import { PageHeading, Section } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export default async function ResultPage({ params }: { params: Promise<{ clinicId: string; id: string }> }) {
  const { clinicId, id } = await params; const { permissions } = await requireClinic(clinicId, "results.read"); const result = await medicalResult(clinicId,id);
  const editable = result.status === "DRAFT" && can(permissions,"results.manage");
  return <><Link className="text-link" href={`/clinics/${clinicId}/results`}><T>{"Înapoi la rezultate"}</T></Link><div className="mt-6"><PageHeading eyebrow={`${result.service_name} · versiunea ${result.version}`} title={result.title} description={`${result.patient_name} · ${result.doctor_name}`}/></div>
    <Section title="Conținut rezultat">{editable ? <ActionForm action={saveResult.bind(null,clinicId,id)}><input type="hidden" name="appointment_id" value={result.appointment_id}/><input type="hidden" name="doctor_id" value={result.doctor_location_id}/><input type="hidden" name="version" value={result.version}/><Field label="Titlu"><Input name="title" defaultValue={result.title} required/></Field><Field label="Rezultat"><textarea className="input textarea result-editor" name="content" defaultValue={result.content} required/></Field><Field label="Motivul modificării"><Input name="change_reason" placeholder="Opțional pentru ciornă"/></Field></ActionForm> : <div className="medical-content">{result.content}</div>}</Section>
    <Section title="Flux medical" description="Validarea blochează editarea; publicarea generează PDF-ul și îl face vizibil pacientului."><div className="result-actions"><span className={`status result-${result.status.toLowerCase()}`}><T>{resultStatusLabels[result.status]}</T></span>{result.status === "DRAFT" && can(permissions,"results.release") && <ActionForm action={validateResult.bind(null,clinicId,id)} submit="Validează rezultatul"><p className="muted"><T>{"Confirmați că rezultatul este complet și corect."}</T></p></ActionForm>}{result.status === "VALIDATED" && can(permissions,"results.release") && <ActionForm action={releaseResult.bind(null,clinicId,id)} submit="Generează PDF și publică"><p className="muted"><T>{"Pacientul va vedea rezultatul în portal după publicare."}</T></p></ActionForm>}{result.status === "RELEASED" && <Button asChild><a href={`/api/clinics/${clinicId}/results/${id}/download`}><T>{"Descarcă PDF"}</T></a></Button>}</div></Section>
  </>;
}
