import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { assertDeploymentTarget } from "@/lib/deployment-target";

export function adminDb() {
  assertDeploymentTarget(process.env.APP_ENVIRONMENT, process.env.STAGING_SUPABASE_PROJECT_REF, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.APP_ORIGIN);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurația server Supabase lipsește.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function hasAdminConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
