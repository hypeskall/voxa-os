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
  return <main className="standalone"><p className="eyebrow">VOXA · ECHIPĂ</p><h1>Invitație în echipa clinicii</h1><p className="muted">Acceptarea verifică emailul contului și acordă numai rolul și locația stabilite de administrator.</p>{user ? <><p>Cont conectat: {user.email}</p><ActionForm action={acceptInvitation.bind(null, token)} submit="Acceptă invitația"/><p className="muted">Dacă adresa nu corespunde invitației, deconectați-vă înainte de a continua.</p><Link className="text-link" href="/">Înapoi la spațiul de lucru</Link></> : <div className="form-stack"><Link className="text-link" href={`/login?next=${next}`}>Conectează-te pentru a accepta</Link><Link className="text-link" href={`/register?next=${next}`}>Creează un cont cu emailul invitat</Link></div>}</main>;
}
