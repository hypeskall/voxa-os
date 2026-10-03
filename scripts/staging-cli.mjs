import { spawnSync } from "node:child_process";
import { stagingEnv } from "./staging-env.mjs";
import { verifyHostedSchema } from "./staging-schema.mjs";

function cli(packageName, args, env, input) {
  // Only fixed, validated arguments enter cmd.exe. Secrets travel through the
  // child environment or stdin; never shell interpolation or command-line flags.
  if ([packageName, ...args].some(value => !/^[A-Za-z0-9_.@/=-]+$/.test(value))) throw new Error("Unsafe CLI argument.");
  const result = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["npx", "--yes", packageName, ...args].join(" ")], { env, input, encoding: "utf8", timeout: 300000 })
    : spawnSync("npx", ["--yes", packageName, ...args], { env, input, encoding: "utf8", timeout: 300000 });
  if (result.error || result.status !== 0 || /"_tag"\s*:\s*"Error"/.test(result.stdout ?? ""))
    throw new Error("Staging CLI operation failed. Check account access, project reference and database password; raw output suppressed to protect secrets.");
  return result.stdout;
}
try {
  const config = stagingEnv();
  const childEnv = { ...process.env, ...config.env };
  for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "SUPABASE_PROJECT_REF"]) delete childEnv[key];
  const mode = process.argv[2];
  if (mode === "migrate") {
    if (!childEnv.SUPABASE_ACCESS_TOKEN || !childEnv.SUPABASE_DB_PASSWORD) throw new Error("Migration requires staging SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD in .env.staging.local (operator-only).");
    const apply = process.argv[3] === "--apply";
    if (process.argv[3] && !apply) throw new Error("Expected --apply or no argument (dry run).");
    cli("supabase@2.119.0", ["db", "push", "--project-ref", config.ref, "--skip-vault", ...(apply ? ["--yes"] : ["--dry-run"])], childEnv);
    console.log(`PASS: staging migration ${apply ? "apply" : "dry run"}. Seed and local Auth configuration were not pushed.`);
    if (apply) await verifyHostedSchema(config);
  } else if (mode === "vercel-env") {
    const project = config.env.STAGING_VERCEL_PROJECT || "voxa-os-staging";
    if (!/^[a-z0-9-]{3,64}$/.test(project) || ["voxa-os", "denta-os"].includes(project)) throw new Error("Use a dedicated staging Vercel project name.");
    const keys = ["APP_ENVIRONMENT", "STAGING_SUPABASE_PROJECT_REF", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "APP_ORIGIN", "BOOKING_RATE_LIMIT_SALT", "CONFIRMATION_TOKEN_SECRET", "CRON_SECRET", "NOTIFICATION_PROVIDER", "STAFF_INVITATION_PROVIDER", "STAFF_INVITATION_PROVIDER_URL", "STAFF_INVITATION_PROVIDER_TOKEN", "BOOKING_EMBED_ORIGINS"];
    // Supabase account tokens/database passwords are deliberately excluded.
    for (const key of keys.filter(key => config.env[key])) {
      const secret = /SERVICE_ROLE|SECRET|SALT|_TOKEN$/.test(key);
      cli("vercel@62.2.0", ["env", "add", key, "preview", "--project", project, "--scope", "voxa6", secret ? "--sensitive" : "--no-sensitive", "--yes"], childEnv, config.env[key]);
      console.log(`Configured ${key} for staging Preview only.`);
    }
  } else throw new Error("Expected migrate [--apply] or vercel-env.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
