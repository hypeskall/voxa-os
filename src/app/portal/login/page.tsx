import { T } from "@/components/locale-provider";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { requestPortalLink } from "@/features/patient-portal/actions";
import { db } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function PortalLogin(){
  const client = await db();
  const { data: { user } } = await client.auth.getUser();
  if (user) redirect("/portal");
  return <main className="portal-login"><section><p className="eyebrow"><T>{"PORTAL PACIENT"}</T></p><h1><T>{"Accesați documentele medicale"}</T></h1><p className="muted"><T>{"Veți primi pe email un link securizat de autentificare. Nu este necesară o parolă. După conectare, puteți reveni direct în portal pe acest dispozitiv până când vă deconectați sau sesiunea este revocată."}</T></p><ActionForm action={requestPortalLink} submit="Trimite linkul securizat"><Field label="Adresa de email"><Input name="email" type="email" autoComplete="email" required/></Field></ActionForm></section></main>;
}
