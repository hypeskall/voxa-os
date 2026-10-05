import { T } from "@/components/locale-provider";
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
    <p className="eyebrow"><T>{"VOXA · CONTUL MEU"}</T></p><h1><T>{"Securitatea contului"}</T></h1>
    <p className="muted"><T>{"Verificarea în doi pași protejează accesul la clinici și documente cu un cod suplimentar la conectare."}</T></p>
    {disabled && !factor && <p className="message success" role="status"><T>{"Verificarea în doi pași a fost dezactivată."}</T></p>}
    {factor ? <div className="form-stack"><p role="status"><T>{"Aplicație de autentificare activă."}</T></p>
      {required ? <Link className="text-link" href="/auth/mfa?next=%2Faccount%2Fsecurity"><T>{"Confirmă un cod pentru a administra verificarea"}</T></Link> : <MfaDisableForm factorId={factor.id}/>}
    </div> : <MfaEnrollmentForm/>}
    <p className="auth-note"><Link className="text-link" href="/dashboard"><T>{"Înapoi la clinici"}</T></Link></p>
  </div></div></main>;
}
