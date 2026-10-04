import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readEnv } from "./staging-env.mjs";
import { expectedSchema, compareSchema, managementQuery } from "./staging-schema.mjs";

// The historical production migration IDs differ from the repository, so they
// are preserved. Structural equivalence is required before any forward upgrade.
const ref = "fibcbsdattoqiyizzeda";
const config = readEnv(".env.production.local");
if (config.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` || config.APP_ORIGIN !== "https://voxa-os.vercel.app")
  throw new Error("Production target does not match the existing Voxa project.");
if (!config.SUPABASE_ACCESS_TOKEN) throw new Error("Production operator token is missing.");
const query = (sql) => managementQuery(ref, config.SUPABASE_ACCESS_TOKEN, sql);
const catalog = () => query(fs.readFileSync("scripts/staging-schema.sql", "utf8"));
const versions = () => query("select version from supabase_migrations.schema_migrations order by version");
const files = fs.readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort();
const pending = files.filter(f => f.split("_")[0] > "202609300021");

async function verifyBaseline() {
  const applied = new Set((await versions()).map(x => x.version));
  const baseline = pending.map(f => f.split("_")[0]).filter(v => applied.has(v)).at(-1) ?? "202609300021";
  const expected = await expectedSchema(baseline);
  const actual = await catalog();
  const differences = compareSchema(expected, actual);
  if (differences.length || actual.length !== expected.length)
    throw new Error("Production baseline differs. Refusing upgrade: " + differences.join("; "));
  console.log(`PASS: production exactly matches ${baseline} (${expected.length} catalog checks).`);
  return baseline;
}
async function verifyCurrent() {
  const expected = await expectedSchema();
  const actual = await catalog();
  const differences = compareSchema(expected, actual);
  const history = new Set((await versions()).map(x => x.version));
  if (differences.length || pending.some(f => !history.has(f.split("_")[0])))
    throw new Error("Production release verification failed: " + differences.join("; "));
  console.log(`PASS: production matches the current application (${expected.length} checks); historical migration IDs preserved.`);
}

try {
  const mode = process.argv[2];
  if (mode === "check") {
    const baseline = await verifyBaseline();
    const remaining = pending.filter(f => f.split("_")[0] > baseline);
    if (!remaining.length) await verifyCurrent();
    else console.log("Pending forward migrations: " + remaining.map(f => f.split("_")[0]).join(", "));
  } else if (mode === "apply") {
    const baseline = await verifyBaseline();
    const remaining = pending.filter(f => f.split("_")[0] > baseline);
    if (!remaining.length) { await verifyCurrent(); process.exit(0); }
    // A decrypt-verified, encrypted pre-upgrade snapshot must exist.
    const receipt = JSON.parse(fs.readFileSync(".backups/pre-upgrade.receipt.json", "utf8"));
    const age = Date.now() - Date.parse(receipt.createdAt);
    if (receipt.ref !== ref || !receipt.verified || !Number.isFinite(age) || age < 0 || age > 3600000
      || typeof receipt.path !== "string" || path.dirname(path.resolve(receipt.path)) !== path.resolve(".backups")
      || !fs.existsSync(receipt.path) || !/^[a-f0-9]{64}$/.test(receipt.sha256 || "")
      || createHash("sha256").update(fs.readFileSync(receipt.path)).digest("hex") !== receipt.sha256)
      throw new Error("A verified production recovery snapshot from the last hour is required.");
    const history = await versions();
    if (remaining.some(f => history.some(x => x.version === f.split("_")[0])))
      throw new Error("Partially applied upgrade: inspect before retrying.");
    const body = remaining.map(file => {
      const version = file.split("_")[0];
      const name = file.slice(version.length + 1, -4);
      if (!/^\d+$/.test(version) || !/^[a-z_]+$/.test(name)) throw new Error("Invalid migration name.");
      return fs.readFileSync(`supabase/migrations/${file}`, "utf8") + `\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[]::text[]);\n`;
    }).join("\n");
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST", headers: { Authorization: `Bearer ${config.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `begin; set local lock_timeout='5s'; set local statement_timeout='90s';\n${body}\ncommit;`, read_only: false }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Production upgrade failed (HTTP ${response.status}); sensitive response suppressed. Inspect history before retrying.`);
    console.log(`Applied ${remaining.length} forward migrations atomically; no reset, seed or migration-history rewrite.`);
    await verifyCurrent();
  } else throw new Error("Use check or apply.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
