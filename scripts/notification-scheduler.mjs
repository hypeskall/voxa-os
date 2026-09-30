import { createClient } from "@supabase/supabase-js";

// Environment files remain gitignored. No secrets are accepted as command arguments.
process.loadEnvFile(process.env.NOTIFICATION_ENV_FILE || ".env.local");
const mode = process.argv[2];
const origin = process.env.APP_ORIGIN?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
if (!origin || !secret) throw new Error("APP_ORIGIN and CRON_SECRET are required.");
const url = new URL(origin);
if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("APP_ORIGIN must be an origin only.");
if (mode === "configure") {
  if (url.protocol !== "https:" || secret.length < 32 || /\s/.test(secret)) throw new Error("Use a production HTTPS origin and a CRON_SECRET of at least 32 characters without whitespace.");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Server-side Supabase configuration is required.");
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.rpc("configure_notification_scheduler", {
    worker_origin: origin, worker_secret: secret, enabled: process.env.NOTIFICATION_SCHEDULER_ENABLED !== "false",
  });
  if (error) throw new Error(`Scheduler configuration failed (${error.code}). Apply migration 020 and check Supabase extensions.`);
  console.log("Supabase notification scheduler configured.");
} else if (mode === "process") {
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Use HTTPS or a local development server.");
  const response = await fetch(`${origin}/api/internal/notifications/process`, {
    method: "POST", redirect: "error", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Notification worker failed (HTTP ${response.status}).`);
  const result = await response.json();
  console.log(`Notifications: ${result.claimed} claimed, ${result.sent} sent.`);
} else {
  throw new Error("Expected configure or process.");
}
