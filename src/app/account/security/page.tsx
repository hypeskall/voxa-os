import Link from "next/link";
import { authenticatedUser } from "@/features/auth/access";
import { mfaRequired } from "@/features/auth/mfa";
import { MfaEnrollmentForm, MfaDisableForm } from "@/features/auth/mfa-forms";
export const metadata = { title: "Securitatea contului" };
export default async function AccountSecurity({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const { client } = await authenticatedUser();
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw new Error("Metodele de verificare nu au putut fi încărcate.");
  const required = await mfaRequired(client);
  const factor = factors.data.totp[0];
  const disabled = (await searchParams).mfa === "disabled";
  return <main className="auth-page"><div className="auth-main"><div className="auth-box">
    <p className="eyebrow">VOXA · CONTUL MEU</p><h1>Securitatea contului</h1>
    <p className="muted">Verificarea în doi pași protejează accesul la clinici și documente cu un cod suplimentar la conectare.</p>
    {disabled && !factor && <p className="message success" role="status">Verificarea în doi pași a fost dezactivată.</p>}
    {factor ? <div className="form-stack"><p role="status">Aplicație de autentificare activă.</p>
      {required ? <Link className="text-link" href="/auth/mfa?next=%2Faccount%2Fsecurity">Confirmă un cod pentru a administra verificarea</Link> : <MfaDisableForm factorId={factor.id}/>}
    </div> : <MfaEnrollmentForm/>}
    <p className="auth-note"><Link className="text-link" href="/dashboard">Înapoi la clinici</Link></p>
  </div></div></main>;
}
