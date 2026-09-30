"use client";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import type { Database } from "@/types/database";
// Public, anonymous client only. Auth and user-context queries remain server-side;
// HttpOnly tokens never need to be readable by browser JavaScript.
export function publicDb() {
  const { url, key } = supabaseConfig();
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
