import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function mfaRequired(client: SupabaseClient, verifiedUser?: User) {
  const session = await client.auth.getSession();
  if (session.error || !session.data.session) throw new Error("Sesiunea nu mai este disponibilă. Reîncercați conectarea.");
  if (verifiedUser && verifiedUser.id !== session.data.session.user.id)
    throw new Error("Securitatea sesiunii nu a putut fi verificată. Reîncercați conectarea.");
  // Reuse a fresh getUser() result when the caller already verified the user.
  // Only the current AAL comes from the SDK's token; factors always come from
  // Auth, never from the potentially stale cookie user metadata.
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(verifiedUser ? undefined : session.data.session.access_token);
  if (error || !data) throw new Error("Securitatea sesiunii nu a putut fi verificată. Reîncercați conectarea.");
  const enrolled = verifiedUser ? verifiedUser.factors?.some(factor => factor.status === "verified") : data.nextLevel === "aal2";
  return Boolean(enrolled) && data.currentLevel !== "aal2";
}
