import { T } from "@/components/locale-provider";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { confirmRecovery } from "@/features/auth/account-actions";
import { emailTokenHashSchema } from "@/features/auth/callback-model";

export const metadata = { title: "Confirmare recuperare", robots: { index: false, follow: false } };
export default async function Recovery({ searchParams }: { searchParams: Promise<{ token_hash?: string | string[] }> }) {
  const token = emailTokenHashSchema.safeParse((await searchParams).token_hash);
  return <main className="auth-page"><div className="auth-main"><div className="auth-box">
    <p className="eyebrow"><T>{"VOXA · ADMINISTRARE MEDICALĂ"}</T></p><h1><T>{"Continuă recuperarea parolei"}</T></h1>
    {token.success ? <>
      <p className="muted"><T>{"Apasă „Continuă” pentru a deschide formularul în care alegi parola nouă. Folosește linkul din cel mai recent email."}</T></p>
      <ActionForm action={confirmRecovery} submit="Continuă"><input type="hidden" name="token_hash" value={token.data}/></ActionForm>
    </> : <p className="message error" role="alert"><T>{"Linkul nu este valid. Solicitați un nou link de recuperare."}</T></p>}
    <p className="auth-note"><Link className="text-link" href="/forgot-password"><T>{"Solicită un nou link de recuperare"}</T></Link></p>
  </div></div></main>;
}
