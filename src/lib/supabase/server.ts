import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { supabaseConfig, cookieOptions } from "./config";
import { assertDeploymentTarget } from "@/lib/deployment-target";
export async function db() {
  assertDeploymentTarget(process.env.APP_ENVIRONMENT, process.env.STAGING_SUPABASE_PROJECT_REF, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.APP_ORIGIN);
  const jar = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient<Database>(url, key, {
    cookieOptions,
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, { ...options, ...cookieOptions }),
          );
        } catch {
          /* Server Components: proxy persists refreshed cookies. */
        }
      },
    },
  });
}
