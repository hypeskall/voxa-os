import { PageHeading, Section } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { requireClinic } from "@/features/auth/access";
import { saveOrganization } from "@/features/settings/actions";

export const metadata={title:"Organizație"};
export default async function OrganizationSettings({params}:{params:Promise<{clinicId:string}>}) { const {clinicId}=await params; const {client,clinic}=await requireClinic(clinicId,"organization.manage"); const {data,error}=await client.from("organizations").select("name").eq("id",clinic.organization_id).single(); if(error)throw new Error("Organizația nu a putut fi încărcată."); return <><PageHeading eyebrow="SETĂRI" title="Organizație" description="Datele juridice și identitatea organizației."/><Section title="Identitate organizație" description="Modificarea este înregistrată în jurnalul de audit."><div className="max-w-xl"><ActionForm action={saveOrganization.bind(null,clinicId)}><Field label="Denumirea organizației"><Input name="name" required minLength={2} maxLength={100} defaultValue={data.name}/></Field></ActionForm></div></Section></>; }
