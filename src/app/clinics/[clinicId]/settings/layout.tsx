import { SettingsNav } from "@/features/settings/settings-nav";
import { requireClinic } from "@/features/auth/access";
export default async function SettingsLayout({children,params}:{children:React.ReactNode;params:Promise<{clinicId:string}>}) { const {clinicId}=await params; const {permissions,clinic}=await requireClinic(clinicId); return <><SettingsNav clinicId={clinicId} organizationId={clinic.organization_id} permissions={permissions}/>{children}</>; }
