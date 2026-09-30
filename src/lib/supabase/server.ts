import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { supabaseConfig, cookieOptions } from "./config";
export async function db() {
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
