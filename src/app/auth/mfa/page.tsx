import Link from "next/link";
import { redirect } from "next/navigation";
import { authenticatedUser } from "@/features/auth/access";
import { mfaRequired } from "@/features/auth/mfa";
import { safeMfaDestination } from "@/features/auth/mfa-model";
import { MfaChallengeForm } from "@/features/auth/mfa-forms";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Verificare în doi pași" };
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeMfaDestination((await searchParams).next ?? null);
  const { client } = await authenticatedUser();
  if (!(await mfaRequired(client))) redirect(next);
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw new Error("Metodele de verificare nu au putut fi încărcate.");
  const factor = factors.data.totp[0];
  return <main className="auth-page"><div className="auth-main"><div className="auth-box">
    <p className="eyebrow">VOXA · SECURITATEA CONTULUI</p><h1>Verificare în doi pași</h1>
    <p className="muted">Introduceți codul curent din aplicația de autentificare de pe telefon pentru a continua.</p>
    {factor ? <MfaChallengeForm factorId={factor.id} next={next}/> : <p role="alert">Contul folosește o metodă de verificare care nu este disponibilă aici. Contactați suportul.</p>}
    <p className="auth-note">Nu mai aveți acces la aplicație? Folosiți cheia păstrată la configurare pe un alt dispozitiv sau <Link href="mailto:contact@voxatech.ro" className="text-link">contactați suportul</Link>.</p>
    <form action={logout}><Button variant="outline" type="submit">Deconectare</Button></form>
  </div></div></main>;
}
