"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";
export type ActionState = { error?: string; success?: string };
export async function login(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = loginSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Introduceți o adresă de email validă și parola." };
  const client = await db();
  const { error } = await client.auth.signInWithPassword(input.data);
  if (error)
    return {
      error:
        error.status === 429
          ? "Prea multe încercări. Reîncercați mai târziu."
          : "Autentificarea nu a reușit. Verificați emailul și parola.",
    };
  const audit = await client.rpc("record_login");
  if (audit.error) {
    await client.auth.signOut();
    return { error: "Conectarea nu a putut fi înregistrată. Reîncercați." };
  }
  redirect("/");
}
export async function logout() {
  const client = await db();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Deconectarea nu a reușit. Reîncercați.");
  redirect("/login");
}
