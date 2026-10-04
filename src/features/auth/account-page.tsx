import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { registerAccount, resetPassword } from "./account-actions";
import { ForgotPasswordForm } from "./forgot-password-form";
export function AccountPage({ mode, next = "/" }: { mode: "register" | "forgot" | "reset"; next?: string }) {
  const title = mode === "register" ? "Creează contul" : mode === "forgot" ? "Recuperare parolă" : "Alege o parolă nouă";
  return <main className="auth-page"><div className="auth-main"><div className="auth-box">
    <p className="eyebrow">VOXA · ADMINISTRARE MEDICALĂ</p><h1>{title}</h1>
    <p className="muted">{mode === "register" ? "30 de zile gratuit pentru echipa clinicii. Fără plată inițială. Configurare ghidată, pas cu pas." : "Accesul la cont este verificat în siguranță."}</p>
    {mode === "forgot" ? <ForgotPasswordForm/> : <ActionForm action={mode === "register" ? registerAccount : resetPassword} submit={mode === "register" ? "Creează contul" : "Actualizează parola"}>
      <input type="hidden" name="next" value={next}/>
      {mode === "register" && <Field label="Nume complet"><Input name="full_name" autoComplete="name" required minLength={2} maxLength={100}/></Field>}
      {mode !== "reset" && <Field label="Email"><Input name="email" type="email" autoComplete="email" required maxLength={254}/></Field>}
      <Field label="Parolă"><Input name="password" type="password" aria-describedby="password-guidance" autoComplete="new-password" required minLength={12} maxLength={128}/></Field><p className="muted" id="password-guidance">Cel puțin 12 caractere.</p><Field label="Confirmă parola"><Input name="password_confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></Field>
    </ActionForm>}
    {mode === "register" && <div className="auth-legal-note"><p>Consultă <Link className="text-link" href="/legal/terms">termenii</Link>, <Link className="text-link" href="/legal/privacy">confidențialitatea</Link> și <Link className="text-link" href="/legal/cookies">politica de cookies</Link>.</p><p>Documentele sunt în curs de finalizare. Folosește date fictive pentru testare până la finalizarea condițiilor pentru date reale. Crearea contului nu semnează DPA-ul clinicii.</p></div>}
    <p className="auth-note"><Link className="text-link" href={`/login?next=${encodeURIComponent(next)}`}>Înapoi la conectare</Link></p>
  </div></div></main>;
}
