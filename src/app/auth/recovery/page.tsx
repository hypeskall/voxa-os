import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { confirmRecovery } from "@/features/auth/account-actions";
import { emailTokenHashSchema } from "@/features/auth/callback-model";

export const metadata = { title: "Confirmare recuperare", robots: { index: false, follow: false } };
export default async function Recovery({ searchParams }: { searchParams: Promise<{ token_hash?: string | string[] }> }) {
  const token = emailTokenHashSchema.safeParse((await searchParams).token_hash);
  return <main className="auth-page"><div className="auth-main"><div className="auth-box">
    <p className="eyebrow">VOXA · ADMINISTRARE MEDICALĂ</p><h1>Continuă recuperarea parolei</h1>
    {token.success ? <>
      <p className="muted">Apasă „Continuă” pentru a deschide formularul în care alegi parola nouă. Folosește linkul din cel mai recent email.</p>
      <ActionForm action={confirmRecovery} submit="Continuă"><input type="hidden" name="token_hash" value={token.data}/></ActionForm>
    </> : <p className="message error" role="alert">Linkul nu este valid. Solicitați un nou link de recuperare.</p>}
    <p className="auth-note"><Link className="text-link" href="/forgot-password">Solicită un nou link de recuperare</Link></p>
  </div></div></main>;
}
