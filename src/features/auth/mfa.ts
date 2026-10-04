import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function mfaRequired(client: SupabaseClient) {
  const session = await client.auth.getSession();
  if (session.error || !session.data.session) throw new Error("Sesiunea nu mai este disponibilă. Reîncercați conectarea.");
  // Passing the token makes the SDK fetch the current factors from Auth. Cookie
  // user metadata can predate enrollment on another device.
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(session.data.session.access_token);
  if (error || !data) throw new Error("Securitatea sesiunii nu a putut fi verificată. Reîncercați conectarea.");
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}
