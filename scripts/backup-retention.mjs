import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readEnv } from "./staging-env.mjs";
import { r2Settings } from "./backup-r2.mjs";
export const minimumBackupRetentionSeconds = 30 * 86400;
export function coversBackup(rules, objectKey, now = Date.now()) {
  return Array.isArray(rules) && rules.some(rule => rule.enabled === true && typeof (rule.prefix ?? "") === "string" && objectKey.startsWith(rule.prefix ?? "") && (
    rule.condition?.type === "Indefinite"
    || rule.condition?.type === "Age" && Number.isFinite(rule.condition.maxAgeSeconds) && rule.condition.maxAgeSeconds >= minimumBackupRetentionSeconds
    || rule.condition?.type === "Date" && Date.parse(rule.condition.date) - now >= minimumBackupRetentionSeconds * 1000
  ));
}
async function lockRequest(settings, method = "GET", body, fetcher = fetch) {
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${settings.account}/r2/buckets/${settings.bucket}/lock`, { method, headers: { Authorization: `Bearer ${settings.token}`, "cf-r2-jurisdiction": "eu", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Backup retention access failed (HTTP ${response.status}).`);
  const data = await response.json();
  if (data.success !== true) throw new Error("Backup retention state unavailable.");
  return data.result;
}
export async function assertBackupRetention(settings, objectKey, fetcher = fetch) {
  const result = await lockRequest(settings, "GET", undefined, fetcher);
  if (!coversBackup(result?.rules, objectKey)) throw new Error("Verified 30-day backup deletion protection required.");
}
export async function configureBackupRetention(settings, fetcher = fetch) {
  const prior = await lockRequest(settings, "GET", undefined, fetcher);
  if (!Array.isArray(prior?.rules)) throw new Error("Unknown retention configuration; no change made.");
  const rule = { id: "voxa-backups-30-days", enabled: true, prefix: "voxa/", condition: { type: "Age", maxAgeSeconds: minimumBackupRetentionSeconds } };
  // Retain all existing rules, including stricter holds. Do not create lifecycle
  // deletion rules or weaken an existing rule with the same ID.
  const rules = [...prior.rules];
  if (!coversBackup(rules, "voxa/")) {
    if (rules.some(existing => existing.id === rule.id)) throw new Error("Conflicting lock ID; review before changing it.");
    rules.push(rule);
    await lockRequest(settings, "PUT", { rules }, fetcher);
  }
  await assertBackupRetention(settings, "voxa/", fetcher);
  return { verified: true, prefix: "voxa/", minimumRetentionDays: 30, verifiedAt: new Date().toISOString() };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const settings = r2Settings(readEnv(process.env.BACKUP_ENV_FILE || ".env.backup.local"));
    if (process.argv[2] === "configure") {
      const receipt = await configureBackupRetention(settings);
      fs.mkdirSync(".backups", { recursive: true });
      fs.writeFileSync(".backups/retention.receipt.json", JSON.stringify(receipt));
      console.log("PASS: backup objects have verified deletion/overwrite protection until 30 days after creation; existing stricter rules preserved. No automatic deletion enabled.");
    } else if (process.argv[2] === "check") {
      await assertBackupRetention(settings, "voxa/");
      console.log("PASS: backup deletion protection verified.");
    } else throw new Error("Use check or configure.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
