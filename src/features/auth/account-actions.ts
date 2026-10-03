"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/app-origin";
import { requireUser } from "./access";
import { registerSchema, resetSchema, safeAuthDestination } from "./account-model";
import { emailTokenHashSchema } from "./callback-model";
import type { ActionState } from "./actions";
export async function registerAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const input = registerSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Verificați numele, emailul și parolele identice de cel puțin 12 caractere." };
  const client = await db();
  const next = safeAuthDestination(String(form.get("next") ?? "/"));
  const { data, error } = await client.auth.signUp({ email: input.data.email, password: input.data.password, options: { data: { full_name: input.data.full_name }, emailRedirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}` } });
  if (error) return { error: error.status === 429 ? "Prea multe încercări. Reîncercați mai târziu." : "Contul nu a putut fi creat. Verificați datele sau folosiți recuperarea parolei." };
  if (data.session) redirect(next === "/" ? "/dashboard" : next);
  return { success: "Verificați emailul pentru confirmarea contului, apoi conectați-vă. Dacă aveți deja cont, folosiți Conectare." };
}
export async function forgotPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Introduceți o adresă de email validă." };
  const client = await db();
  const { error } = await client.auth.resetPasswordForEmail(email.data, { redirectTo: `${appOrigin()}/auth/callback?next=/reset-password` });
  if (error) return { error: error.status === 429 ? "Prea multe încercări. Reîncercați mai târziu." : "Solicitarea nu a putut fi trimisă. Reîncercați." };
  return { success: "Dacă adresa are un cont, veți primi un link pentru alegerea unei parole noi." };
}
export async function confirmRecovery(_: ActionState, form: FormData): Promise<ActionState> {
  const token = emailTokenHashSchema.safeParse(form.get("token_hash"));
  if (!token.success) return { error: "Linkul nu este valid. Solicitați un nou link de recuperare." };
  const client = await db();
  const { error } = await client.auth.verifyOtp({ token_hash: token.data, type: "recovery" });
  if (error) return { error: "Linkul a expirat, a fost deja folosit sau a fost înlocuit. Folosiți cel mai recent email ori solicitați un nou link." };
  redirect("/reset-password");
}
export async function resetPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const input = resetSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Folosiți cel puțin 12 caractere și confirmați aceeași parolă." };
  const { client } = await requireUser();
  const { error } = await client.auth.updateUser({ password: input.data.password });
  if (error) return { error: "Parola nu a putut fi actualizată. Solicitați un nou link sau reîncercați." };
  const signout = await client.auth.signOut({ scope: "global" });
  if (signout.error) return { error: "Parola a fost actualizată, dar sesiunile nu au putut fi închise. Reîncercați deconectarea." };
  redirect("/login?password=updated");
}
