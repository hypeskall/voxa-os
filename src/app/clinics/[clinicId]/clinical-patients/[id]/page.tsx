import { z } from "zod";
import { notFound } from "next/navigation";
import { requireClinic } from "@/features/auth/access";
import { PageHeading } from "@/components/ui/page";
import { PatientNotes } from "@/features/privacy/patient-notes";
import { PatientDocuments } from "@/features/documents/patient-documents";
import { PatientResults } from "@/features/results/patient-results";
export default async function WorkflowPatient({ params }: { params:Promise<{clinicId:string;id:string}> }) {
  const { clinicId,id }=await params; const {client}=await requireClinic(clinicId,"results.manage");
  if(!z.uuid().safeParse(id).success)notFound();
  const {data,error}=await client.rpc("read_workflow_patient",{cid:clinicId,pid:id});
  if(error||!data)notFound();
  const patient=z.object({name:z.string()}).parse(data);
  return <><PageHeading eyebrow="ACTIVITATE CLINICĂ" title={patient.name} description="Pacient asociat fluxului dumneavoastră clinic."/><PatientNotes cid={clinicId} pid={id}/><PatientDocuments cid={clinicId} pid={id}/><PatientResults cid={clinicId} pid={id}/></>;
}
