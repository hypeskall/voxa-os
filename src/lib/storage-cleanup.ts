import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function cleanupUploads(client: SupabaseClient<Database>, bucket: "voxa-medical" | "voxa-branding", paths: string[]) {
  if (!paths.length) return "";
  try {
    const removed = await client.storage.from(bucket).remove(paths);
    // Storage may return no deleted rows when a policy denies deletion.
    if (!removed.error && removed.data?.length === paths.length) return "";
  } catch { /* The durable queue below also covers network failures. */ }
  let queued = true;
  for (const path of paths) {
    try {
      const { error } = await client.rpc("queue_storage_cleanup", { bucket, path });
      if (error) queued = false;
    } catch { queued = false; }
  }
  return queued
    ? " Curățarea fișierelor temporare a fost înregistrată pentru administrator."
    : " Curățarea fișierelor temporare necesită verificarea administratorului în Storage.";
}
