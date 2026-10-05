import { T } from "@/components/locale-provider";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { invitationTokenSchema } from "@/features/organizations/invitation-model";
import { acceptInvitation } from "@/features/organizations/invitation-actions";
import { ActionForm } from "@/components/ui/action-form";
export const metadata = { title: "Invitație în echipă", robots: { index: false, follow: false } };
export default async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; if (!invitationTokenSchema.safeParse(token).success) notFound();
  const client = await db(); const { data: { user } } = await client.auth.getUser();
  const next = encodeURIComponent(`/invitations/${token}`);
  return <main className="standalone"><p className="eyebrow"><T>{"VOXA · ECHIPĂ"}</T></p><h1><T>{"Invitație în echipa clinicii"}</T></h1><p className="muted"><T>{"Acceptarea verifică emailul contului și acordă numai rolul și locația stabilite de administrator."}</T></p>{user ? <><p><T>{"Cont conectat: "}</T>{user.email}</p><ActionForm action={acceptInvitation.bind(null, token)} submit="Acceptă invitația"/><p className="muted"><T>{"Dacă adresa nu corespunde invitației, deconectați-vă înainte de a continua."}</T></p><Link className="text-link" href="/"><T>{"Înapoi la spațiul de lucru"}</T></Link></> : <div className="form-stack"><Link className="text-link" href={`/login?next=${next}`}><T>{"Conectează-te pentru a accepta"}</T></Link><Link className="text-link" href={`/register?next=${next}`}><T>{"Creează un cont cu emailul invitat"}</T></Link></div>}</main>;
}
