import { authenticatedUser } from "@/features/auth/access";
import { reauthenticate } from "@/features/auth/reauthenticate-actions";
import { safeSessionDestination } from "@/features/auth/session-model";
import { ActionForm } from "@/components/ui/action-form";
import { PasswordField } from "@/features/auth/password-input";
import { T } from "@/components/locale-provider";
export default async function Reauthenticate({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await authenticatedUser();
  const next = safeSessionDestination((await searchParams).next ?? "/dashboard");
  return <main className="auth-page"><div className="auth-main"><div className="auth-box">
    <h1><T>{"Confirmă accesul"}</T></h1>
    <p><T>{"Pentru această operațiune, introduceți din nou parola contului dumneavoastră."}</T></p>
    <ActionForm action={reauthenticate} submit="Confirmă parola">
      <input type="hidden" name="next" value={next} />
      <PasswordField name="password" label="Parolă" autoComplete="current-password" required />
    </ActionForm>
  </div></div></main>;
}
