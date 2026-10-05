import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { readEnv } from "./staging-env.mjs";
import { authEmailConfiguration } from "./auth-email-templates.mjs";

export async function configureAuthEmails(mode, staging = false) {
  if (!["check", "apply"].includes(mode)) throw Error("Use check or apply [staging].");
  const env = readEnv(staging ? ".env.staging.local" : ".env.production.local");
  const ref = staging ? "wlnrfjrjkyywqyvsngps" : "fibcbsdattoqiyizzeda";
  const origin = staging ? "https://voxa-os-staging-voxa6.vercel.app" : "https://voxa-os.vercel.app";
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` || env.APP_ORIGIN !== origin) throw Error("Auth email target mismatch.");
  const headers = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" };
  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const expected = authEmailConfiguration(staging);
  if (mode === "apply") {
    const response = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(expected), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Auth template update HTTP ${response.status}; diagnostics suppressed.`);
  }
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Auth readback HTTP ${response.status}; diagnostics suppressed.`);
  const actual = await response.json();
  const mismatches = Object.keys(expected).filter(key => actual[key]?.replaceAll("\r\n", "\n") !== expected[key].replaceAll("\r\n", "\n"));
  if (mismatches.length) throw Error(`Auth email mismatch: ${mismatches.join(", ")}`);
  const receipt = { verifiedAt: new Date().toISOString(), environment: staging ? "staging" : "production", fields: Object.keys(expected), matches: true, emailSent: false };
  fs.mkdirSync(".staging-deploy", { recursive: true });
  fs.writeFileSync(`.staging-deploy/auth-email-${receipt.environment}.receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(`PASS: ${receipt.environment} four Romanian subjects and templates match. No email sent; Inbox verification remains separate.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  configureAuthEmails(process.argv[2], process.argv[3] === "staging").catch(error => { console.error(error.message); process.exitCode = 1; });
}
