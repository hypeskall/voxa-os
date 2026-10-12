"use server";
import { redirect } from "next/navigation";
import { authenticatedUser } from "./access";
import { safeSessionDestination } from "./session-model";
import { mfaRequired } from "./mfa";
import { sessionStatus } from "./session";
import type { ActionState } from "./actions";
export async function reauthenticate(_: ActionState, form: FormData): Promise<ActionState> {
  const { client, user } = await authenticatedUser();
  const password = form.get("password");
  if (!user.email || typeof password !== "string" || !password || password.length > 1024)
    return { error: "Introduceți parola contului dumneavoastră." };
  const result = await client.auth.signInWithPassword({ email: user.email, password });
  if (result.error || result.data.user?.id !== user.id)
    return { error: "Parola nu a putut fi confirmată. Reîncercați." };
  if (!(await sessionStatus(client)).allowed) return { error: "Sesiunea nu a putut fi confirmată." };
  const next = safeSessionDestination(String(form.get("next") ?? "/dashboard"));
  if (await mfaRequired(client)) redirect(`/auth/mfa?next=${encodeURIComponent(next)}`);
  redirect(next);
}
