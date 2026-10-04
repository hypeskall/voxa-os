"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";
import { loginIdentityEmail } from "./login-identity";
import { safeAuthDestination } from "./account-model";
export type ActionState = { error?: string; success?: string; invitationUrl?: string };
export async function login(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = loginSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Introduceți un utilizator valid și parola." };
  const client = await db();
  const { error } = await client.auth.signInWithPassword({
    email: loginIdentityEmail(input.data.identifier),
    password: input.data.password,
  });
  if (error)
    return {
      error:
        error.status === 429
          ? "Prea multe încercări. Reîncercați mai târziu."
          : "Autentificarea nu a reușit. Verificați utilizatorul și parola.",
    };
  const audit = await client.rpc("record_login");
  if (audit.error) {
    await client.auth.signOut();
    return { error: "Conectarea nu a putut fi înregistrată. Reîncercați." };
  }
  const destination = safeAuthDestination(String(form.get("next") ?? "/"));
  redirect(destination === "/" ? "/dashboard" : destination);
}
export async function logout() {
  const client = await db();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Deconectarea nu a reușit. Reîncercați.");
  redirect("/login");
}
export async function switchAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const destination = form.get("destination") === "/register" ? "/register" : "/login";
  const client = await db();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) return { error: "Deconectarea nu a reușit. Reîncercați." };
  const next = safeAuthDestination(String(form.get("next") ?? "/"));
  redirect(next === "/" ? destination : `${destination}?next=${encodeURIComponent(next)}`);
}
