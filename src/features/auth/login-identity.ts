/** Supabase stores staff usernames as unique, non-deliverable internal emails. */
export function loginIdentityEmail(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  return normalized.includes("@")
    ? normalized
    : `${normalized}@users.voxa.invalid`;
}
