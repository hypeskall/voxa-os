import { PageHeading, Section } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { requireClinic } from "@/features/auth/access";
import { saveOrganization } from "@/features/settings/actions";
import { uploadOrganizationLogo } from "@/features/onboarding/actions";
import Link from "next/link";

export const metadata={title:"Organizație"};
export default async function OrganizationSettings({params}:{params:Promise<{clinicId:string}>}) {
 const {clinicId}=await params; const {client,clinic}=await requireClinic(clinicId,"organization.manage");
 const {data,error}=await client.from("organizations").select("name,legal_name,cui,email,phone,website,specialty,trial_ends_at,subscription_status,logo_path").eq("id",clinic.organization_id).single();
 if(error)throw new Error("Organizația nu a putut fi încărcată.");
 return <><PageHeading eyebrow="SETĂRI" title="Organizație" description="Datele juridice și identitatea organizației."/><Section title="Identitate organizație" description="Modificarea este înregistrată în jurnalul de audit."><div className="max-w-xl"><ActionForm action={saveOrganization.bind(null,clinicId)}><Field label="Denumirea organizației"><Input name="name" required minLength={2} maxLength={100} defaultValue={data.name}/></Field><Field label="Denumire juridică"><Input name="legal_name" maxLength={160} defaultValue={data.legal_name}/></Field><Field label="CUI"><Input name="cui" maxLength={30} defaultValue={data.cui}/></Field><Field label="Email organizație"><Input name="email" type="email" required maxLength={254} defaultValue={data.email}/></Field><Field label="Telefon organizație"><Input name="phone" type="tel" maxLength={40} defaultValue={data.phone}/></Field><Field label="Website"><Input name="website" type="url" maxLength={500} defaultValue={data.website}/></Field><Field label="Specialitate"><Input name="specialty" maxLength={120} defaultValue={data.specialty}/></Field></ActionForm></div></Section><Section title="Logo"><ActionForm action={uploadOrganizationLogo.bind(null,clinic.organization_id)} submit="Încarcă logo-ul"><Field label="Imagine logo" hint="PNG, JPEG sau WebP, maximum 3 MB."><Input name="file" type="file" accept="image/png,image/jpeg,image/webp" required/></Field></ActionForm>{data.logo_path&&<p className="muted">Logo salvat în spațiul privat.</p>}</Section><Section title="Abonament și licență"><p>Voxa-OS Monthly · 19,99 EUR / lună. Consultați starea actuală a trialului și licenței organizației.</p><Link className="text-link" href={`/organizations/${clinic.organization_id}/billing`}>Gestionează abonamentul</Link></Section></>;
}
