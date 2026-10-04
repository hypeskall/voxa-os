"use server";
import { redirect } from "next/navigation";
import { authenticatedUser } from "./access";
import { mfaRequired } from "./mfa";
import { mfaCodeSchema, mfaFactorSchema, safeMfaDestination } from "./mfa-model";

export type MfaState = { error?: string; success?: string; enrollment?: { id: string; qrCode: string; secret: string } };

export async function enrollMfa(): Promise<MfaState> {
  const { client } = await authenticatedUser();
  if (await mfaRequired(client)) redirect("/auth/mfa?next=%2Faccount%2Fsecurity");
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) return { error: "Metodele de verificare nu au putut fi încărcate." };
  if (factors.data.totp.length) return { error: "Contul are deja o aplicație de autentificare activă." };
  // An interrupted enrollment is replaced only for this signed-in user's unverified TOTP factor.
  for (const factor of factors.data.all.filter(f => f.factor_type === "totp" && f.status === "unverified")) {
    const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (removed.error) return { error: "Configurarea anterioară nu a putut fi închisă. Reîncercați." };
  }
  const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Aplicație de autentificare Voxa", issuer: "Voxa-OS" });
  if (error || !data) return { error: "Configurarea nu a reușit. Reîncercați mai târziu." };
  return { enrollment: { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyMfa(_: MfaState, form: FormData): Promise<MfaState> {
  const factor = mfaFactorSchema.safeParse(form.get("factor_id"));
  const code = mfaCodeSchema.safeParse(form.get("code"));
  if (!factor.success || !code.success) return { error: "Introduceți codul de 6 cifre din aplicația de autentificare." };
  const { client } = await authenticatedUser();
  const factors = await client.auth.mfa.listFactors();
  if (factors.error || !factors.data.all.some(f => f.id === factor.data && f.factor_type === "totp"))
    return { error: "Metoda de verificare nu este disponibilă pentru acest cont." };
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.data, code: code.data });
  if (error) return { error: error.status === 429 ? "Prea multe încercări. Așteptați înainte de a încerca din nou." : "Codul nu este valid sau a expirat. Folosiți codul curent din aplicație." };
  const audit = await client.rpc("record_login");
  if (audit.error) return { error: "Verificarea a reușit, dar conectarea nu a putut fi înregistrată. Reîncercați." };
  redirect(safeMfaDestination(String(form.get("next") ?? "/account/security")));
}

export async function disableMfa(_: MfaState, form: FormData): Promise<MfaState> {
  const factor = mfaFactorSchema.safeParse(form.get("factor_id"));
  if (!factor.success || form.get("confirm") !== "on") return { error: "Confirmați dezactivarea verificării în doi pași." };
  const { client } = await authenticatedUser();
  if (await mfaRequired(client)) redirect("/auth/mfa?next=%2Faccount%2Fsecurity");
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data.currentLevel !== "aal2") return { error: "Confirmați mai întâi un cod din aplicația de autentificare." };
  const factors = await client.auth.mfa.listFactors();
  if (factors.error || !factors.data.totp.some(f => f.id === factor.data)) return { error: "Metoda nu este disponibilă pentru acest cont." };
  const removed = await client.auth.mfa.unenroll({ factorId: factor.data });
  if (removed.error) return { error: "Dezactivarea nu a reușit. Reîncercați." };
  const refreshed = await client.auth.refreshSession();
  if (refreshed.error) {
    await client.auth.signOut({ scope: "local" });
    redirect("/login?next=%2Faccount%2Fsecurity");
  }
  redirect("/account/security?mfa=disabled");
}
