import { requireClinic } from "@/features/auth/access";
import { PageHeading } from "@/components/ui/page";
import { ImportPanel } from "@/features/patient-import/import-panel";
export default async function Page({params}:{params:Promise<{clinicId:string}>}){const {clinicId}=await params;const {clinic}=await requireClinic(clinicId,"patients.manage");return <><PageHeading eyebrow={clinic.name} title="Import pacienți" description="Verificați fișierul și duplicatele înainte de confirmarea importului."/><ImportPanel cid={clinicId}/></>;}
