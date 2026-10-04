import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { backupRunConfiguration } from "./backup-run.mjs";

export const backupRunnerRepository = "hypeskall/voxa-backup-runner";

export function privateBackupFiles(env, repository) {
  if (env.GITHUB_REPOSITORY !== backupRunnerRepository || repository.full_name !== backupRunnerRepository
    || repository.private !== true || env.PRIVATE_BACKUP_RUNNER_APPROVED !== "true"
    || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME))
    throw new Error("Approved private backup repository required.");
  // Never export the classic account-wide operator token to the scheduled runner.
  if (!/^sbp_fc[A-Za-z0-9_-]+$/.test(env.SUPABASE_BACKUP_READ_TOKEN || ""))
    throw new Error("Use the dedicated project-scoped Database Read token.");
  const service = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (/replace|placeholder|\s/i.test(service)) throw new Error("Invalid Storage server key.");
  if (service.startsWith("eyJ")) {
    let claims;
    try { claims = JSON.parse(Buffer.from(service.split(".")[1], "base64url").toString()); }
    catch { throw new Error("Invalid Storage server key."); }
    if (claims.role !== "service_role" || claims.ref !== "fibcbsdattoqiyizzeda") throw new Error("Foreign Storage key.");
  } else if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(service)) throw new Error("Invalid Storage server key.");
  const source = {
    NEXT_PUBLIC_SUPABASE_URL: "https://fibcbsdattoqiyizzeda.supabase.co",
    APP_ORIGIN: "https://voxa-os.vercel.app",
    SUPABASE_ACCESS_TOKEN: env.SUPABASE_BACKUP_READ_TOKEN,
    SUPABASE_SERVICE_ROLE_KEY: service,
    BACKUP_ENCRYPTION_KEY: env.BACKUP_ENCRYPTION_KEY,
  };
  const destination = {
    R2_ACCOUNT_ID: "cadccbb31d0ffd0623d2f30eec0a3006",
    R2_BUCKET: "voxa-private-backups", R2_JURISDICTION: "eu",
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    R2_UPLOAD_APPROVED: "true", R2_APPROVED_PROJECT_REF: "fibcbsdattoqiyizzeda",
  };
  backupRunConfiguration(".env.production.local", source, destination);
  const serialize = values => Object.entries(values).map(([key, value]) => {
    if (typeof value !== "string" || /[\r\n\0]/.test(value)) throw new Error("Invalid private value.");
    return `${key}=${value}`;
  }).join("\n") + "\n";
  return { ".env.production.local": serialize(source), ".env.backup.local": serialize(destination) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REPOSITORY !== backupRunnerRepository
      || !process.env.RUNNER_TEMP || !process.env.GITHUB_WORKSPACE
      || path.resolve(process.env.GITHUB_WORKSPACE) !== process.cwd())
      throw new Error("Use only the named temporary GitHub runner workspace.");
    if (process.argv[2] === "cleanup") {
      for (const file of [".env.production.local", ".env.backup.local"]) {
        try { fs.unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    } else {
      const response = await fetch(`https://api.github.com/repos/${backupRunnerRepository}`, {
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
        redirect: "error", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Private repository readback failed.");
      const files = privateBackupFiles(process.env, await response.json());
      for (const [file, content] of Object.entries(files)) fs.writeFileSync(file, content, { flag: "wx", mode: 0o600 });
    }
  } catch {
    console.error("Private backup runner configuration failed; secrets and provider diagnostics suppressed.");
    process.exitCode = 1;
  }
}
