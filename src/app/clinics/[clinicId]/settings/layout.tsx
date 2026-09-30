import { SettingsNav } from "@/features/settings/settings-nav";
export default async function SettingsLayout({children,params}:{children:React.ReactNode;params:Promise<{clinicId:string}>}) { const {clinicId}=await params; return <><SettingsNav clinicId={clinicId}/>{children}</>; }
