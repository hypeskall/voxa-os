import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeSessionDestination } from "./session-model";
export type SessionStatus = { allowed: boolean; idleExpiresAt?: number; absoluteExpiresAt?: number; fresh?: boolean };
export async function sessionStatus(client: SupabaseClient, activity = false): Promise<SessionStatus> {
  const { data, error } = await client.rpc("session_status", { activity });
  if (error || !data || typeof data.allowed !== "boolean") return { allowed: false };
  return data;
}
export async function requireFreshSession(client: SupabaseClient, next: string) {
  const status = await sessionStatus(client);
  if (!status.allowed) redirect("/auth/locked");
  if (!status.fresh) redirect(`/auth/reauthenticate?next=${encodeURIComponent(safeSessionDestination(next))}`);
}
