import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { AwsClient } from "aws4fetch";
import { createClient } from "@supabase/supabase-js";
import { backupRunnerRepository } from "./backup-ci-env.mjs";
import { snapshotCodec, snapshotHash } from "./snapshot-codec.mjs";
import { r2Settings, assertPrivateBucket } from "./backup-r2.mjs";
import { canonicalRows, qualifiedTable, restoreTablePlan, sqlLiteral } from "./restore-plan.mjs";

export const stagingRestoreRef = "wlnrfjrjkyywqyvsngps";
export function isolatedRestoreConfiguration(env, repository) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== backupRunnerRepository
    || repository.full_name !== backupRunnerRepository || repository.private !== true
    || env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.PRIVATE_BACKUP_RUNNER_APPROVED !== "true"
    || !/^[a-f0-9]{64}$/.test(env.STAGING_BACKUP_ENCRYPTION_KEY || "")
    || !/^[a-f0-9]{64}$/.test(env.STAGING_SNAPSHOT_SHA256 || "")
    || !new RegExp(`^voxa/${stagingRestoreRef}/\\d{4}-\\d{2}-\\d{2}/${env.STAGING_SNAPSHOT_SHA256}\\.voxa$`).test(env.STAGING_SNAPSHOT_OBJECT_KEY || ""))
    throw new Error("Approved private isolated staging restore required.");
  return {
    codec: snapshotCodec(Buffer.from(env.STAGING_BACKUP_ENCRYPTION_KEY, "hex"), stagingRestoreRef),
    settings: r2Settings({ ...env, R2_ACCOUNT_ID: "cadccbb31d0ffd0623d2f30eec0a3006", R2_BUCKET: "voxa-private-backups", R2_JURISDICTION: "eu" }),
    objectKey: env.STAGING_SNAPSHOT_OBJECT_KEY, sha256: env.STAGING_SNAPSHOT_SHA256,
  };
}

function command(binary, args, input, timeout = 60000, sensitive = false) {
  const result = spawnSync(binary, args, { input, encoding: "utf8", timeout, maxBuffer: 128 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    // Private diagnostics stay on the disposable runner, never in Actions logs/artifacts.
    fs.writeFileSync(".backups/dr-command-diagnostic.local.txt", sensitive ? "Sensitive command diagnostics suppressed." : String(result.stderr || result.error || "Command failed"), { mode: 0o600 });
    throw new Error("Isolated command failed.");
  }
  return result.stdout;
}
const cli = args => command("npx", ["--yes", "supabase@2.119.0", ...args], undefined, 600000);
const sql = (query, sensitive = false) => {
  const result = command("docker", ["exec", "-i", "supabase_db_voxa-dr", "psql", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], `set timezone='UTC';\n${query}`, 60000, sensitive);
  return result.trim() ? JSON.parse(result.trim()) : null;
};

async function run() {
  let phase = "runner validation";
  try {
    if (process.platform !== "linux" || !process.env.RUNNER_TEMP || path.resolve(process.env.GITHUB_WORKSPACE || "") !== process.cwd())
      throw new Error("Disposable Linux runner workspace required.");
    fs.mkdirSync(".backups", { recursive: true });
    const mode = process.argv[2];
    if (mode === "prepare") {
      if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REPOSITORY !== backupRunnerRepository) throw new Error("Private runner required.");
      // Do not reuse the hosted CLI link. No remote Supabase credentials are used.
      fs.rmSync("supabase/.temp", { recursive: true, force: true });
      const original = fs.readFileSync("supabase/config.toml", "utf8");
      fs.writeFileSync("supabase/config.toml", original.replace('project_id = "voxa-os"', 'project_id = "voxa-dr"').replace(/\[db.seed\]\s+enabled = true/, "[db.seed]\nenabled = false"));
      phase = "isolated Auth, database and Storage startup";
      cli(["start", "-x", "studio,edge-runtime,logflare,vector,supavisor,imgproxy,realtime"]);
      const runtime = JSON.parse(cli(["status", "-o", "json"]));
      if (runtime.API_URL !== "http://127.0.0.1:54321" && runtime.API_URL !== "http://localhost:54321") throw new Error("Loopback runtime required.");
      if (!runtime.SERVICE_ROLE_KEY || !runtime.ANON_KEY) throw new Error("Local runtime keys unavailable.");
      fs.writeFileSync(".backups/dr-runtime.local.json", JSON.stringify(runtime), { mode: 0o600 });
      console.log("PASS: disposable local Auth, PostgreSQL and Storage started without hosted credentials or seed.");
      return;
    }
    if (mode === "cleanup") {
      cli(["stop", "--no-backup"]);
      for (const file of ["dr-runtime.local.json", "dr-command-diagnostic.local.txt"]) fs.rmSync(`.backups/${file}`, { force: true });
      console.log("Disposable restore stack and local diagnostics removed."); return;
    }
    if (mode !== "restore") throw new Error("Use prepare, restore or cleanup.");
    const response = await fetch(`https://api.github.com/repos/${backupRunnerRepository}`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Repository privacy unavailable.");
    const config = isolatedRestoreConfiguration(process.env, await response.json());
    phase = "private R2 download and authenticated decryption";
    await assertPrivateBucket(config.settings);
    const aws = new AwsClient({ accessKeyId: config.settings.accessKeyId, secretAccessKey: config.settings.secretAccessKey, service: "s3", region: "auto", retries: 0 });
    const signed = await aws.sign(`${config.settings.endpoint}/${config.settings.bucket}/${config.objectKey}`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(60000) });
    const download = await fetch(signed);
    if (!download.ok || Number(download.headers.get("content-length")) > 100 * 1024 * 1024) throw new Error("Bounded encrypted download required.");
    const bytes = Buffer.from(await download.arrayBuffer());
    if (bytes.length > 100 * 1024 * 1024 || snapshotHash(bytes) !== config.sha256) throw new Error("Downloaded archive differs.");
    const snapshot = config.codec.open(bytes);
    const runtime = JSON.parse(fs.readFileSync(".backups/dr-runtime.local.json", "utf8"));
    if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(runtime.API_URL)) throw new Error("Refusing non-local restoration.");
    console.log(`PASS: staging archive decrypted in memory (${snapshot.tables.length} tables, ${snapshot.objects.length} private files).`);
    const encrypted = Boolean(snapshot.tables.find(t => t.name === "private.patient_encryption_config")?.rows[0]?.activated_at);
    let patientFetch, fileCrypto;
    const recoveredFileHashes = new Map();
    if (encrypted) {
      // This optional staging-only secret requires separate destination approval.
      // Production backups can copy ciphertext without receiving patient keys.
      process.env.PATIENT_ENCRYPTION_KEYRING = process.env.STAGING_PATIENT_ENCRYPTION_KEYRING || "";
      const encryption = await import("../src/lib/patient-encryption-config.ts");
      const ring = encryption.patientKeyring();
      patientFetch = encryption.patientEncryptionFetch(runtime.API_URL);
      fileCrypto = await import("../src/lib/medical-file-crypto.ts");
      phase = "isolated encrypted schema activation";
      const headers = JSON.stringify({ "x-voxa-patient-keyring": JSON.stringify(ring) });
      sql(`begin; set local role service_role; do $enc$ begin perform set_config('request.headers',${sqlLiteral(headers)},true); perform public.activate_patient_encryption(); end $enc$; commit;`, true);
    }
    phase = "Auth schema compatibility and table restoration";
    // Pause Auth cleanup while proving byte-equivalent records and password hashes.
    command("docker", ["stop", "supabase_auth_voxa-dr"]);
    const plans = [];
    for (const table of snapshot.tables) {
      const columns = sql(`select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'generated',a.attgenerated<>'') order by a.attnum),'[]'::jsonb) from pg_attribute a where a.attrelid=to_regclass(${sqlLiteral(table.name)}) and a.attnum>0 and not a.attisdropped;`);
      plans.push({ table, ...restoreTablePlan(table, columns) });
    }
    const restorable = plans.filter(p => !p.managed && !p.absentEmpty);
    sql(`begin; set local session_replication_role='replica'; truncate ${restorable.map(p => p.target).join(",")} cascade;\n${restorable.map(p => p.sql).join("\n")}\ncommit;`);
    phase = "complete database record comparison";
    for (const plan of restorable) {
      const restored = sql(`select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from ${qualifiedTable(plan.table.name)} t;`);
      if (canonicalRows(restored, plan.sourceFields) !== canonicalRows(plan.table.rows, plan.sourceFields)) throw new Error(`Row comparison differs: ${plan.table.name}`);
    }
    console.log(`PASS: ${restorable.length} Auth/application/private tables match the source fields and row counts; original password hashes included. Auth provider migration history retained for this runtime; ${plans.filter(p => p.absentEmpty).length} unavailable empty provider tables skipped.`);
    command("docker", ["start", "supabase_auth_voxa-dr"]);
    phase = "Storage bucket and object recovery";
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, ...(patientFetch ? { global: { fetch: patientFetch } } : {}) };
    const admin = createClient(runtime.API_URL, runtime.SERVICE_ROLE_KEY, options);
    for (const bucket of snapshot.buckets) {
      if (bucket.public) throw new Error("Private fixture buckets required.");
      const settings = { public: false, fileSizeLimit: bucket.file_size_limit ?? undefined, allowedMimeTypes: bucket.allowed_mime_types ?? undefined };
      const found = await admin.storage.getBucket(bucket.id);
      const saved = found.error ? await admin.storage.createBucket(bucket.id, settings) : await admin.storage.updateBucket(bucket.id, settings);
      if (saved.error) throw new Error("Bucket recovery failed.");
    }
    for (const object of snapshot.objects) {
      const uploaded = await admin.storage.from(object.bucket).upload(object.name, Buffer.from(object.content, "base64"), { contentType: object.type || "application/octet-stream", upsert: false });
      if (uploaded.error) throw new Error("Storage recovery failed.");
      const restored = await admin.storage.from(object.bucket).download(object.name);
      if (restored.error || snapshotHash(Buffer.from(await restored.data.arrayBuffer())) !== object.sha256) throw new Error("Restored file differs.");
      if (encrypted && object.bucket === "voxa-medical") {
        // Prove exact byte recovery above, then authenticate and rebind the file
        // to the disposable project's URL, without writing plaintext to disk.
        process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${stagingRestoreRef}.supabase.co`;
        process.env.PATIENT_ENCRYPTION_READ_LEGACY = "false";
        const plaintext = fileCrypto.decryptMedicalBytes(Buffer.from(object.content, "base64"), object.name);
        process.env.NEXT_PUBLIC_SUPABASE_URL = runtime.API_URL;
        const rebound = fileCrypto.encryptMedicalBytes(plaintext, object.name);
        const saved = await admin.storage.from(object.bucket).upload(object.name, rebound, { contentType: "application/octet-stream", upsert: true });
        const read = await admin.storage.from(object.bucket).download(object.name);
        if (saved.error || read.error || !read.data || snapshotHash(fileCrypto.decryptMedicalBytes(new Uint8Array(await read.data.arrayBuffer()), object.name)) !== snapshotHash(plaintext)) throw new Error("Restored encrypted file integrity failed.");
        recoveredFileHashes.set(object.name, snapshotHash(rebound));
      }
    }
    phase = "restored account password login and tenant isolation";
    const members = snapshot.tables.find(t => t.name === "public.clinic_memberships").rows;
    const users = snapshot.tables.find(t => t.name === "auth.users").rows;
    const first = members.find(m => m.role === "OWNER" && m.active);
    const second = members.find(m => m.role === "OWNER" && m.active && m.organization_id !== first.organization_id);
    if (!first || !second) throw new Error("Two isolated synthetic owners required.");
    const clients = [];
    for (const member of [first, second]) {
      const user = users.find(u => u.id === member.user_id);
      // Change the password ONLY in the disposable restored copy. No additional
      // hosted passwords are exported to GitHub; source hashes were compared above.
      const password = randomBytes(32).toString("base64url");
      const updated = await admin.auth.admin.updateUserById(user.id, { password });
      if (updated.error) throw new Error("Restored account password recovery failed.");
      const client = createClient(runtime.API_URL, runtime.ANON_KEY, options);
      const login = await client.auth.signInWithPassword({ email: user.email, password });
      if (login.error || login.data.user.id !== member.user_id) throw new Error("Restored normal password login failed.");
      const session = await client.rpc("session_status", { activity: false });
      if (session.error || session.data?.allowed !== true) throw new Error("Restored live session gate failed.");
      const own = await client.from("clinics").select("id").eq("id", member.clinic_id);
      if (own.error || own.data.length !== 1) throw new Error("Restored own-clinic access failed.");
      const other = await client.from("clinics").select("id").eq("id", member === first ? second.clinic_id : first.clinic_id);
      if (other.error || other.data.length !== 0) throw new Error("Restored cross-tenant isolation failed.");
      if (encrypted) {
        const ownPatients = await client.from("patients").select("name").eq("clinic_id", member.clinic_id).limit(1);
        const foreignPatients = await client.from("patients").select("name").eq("clinic_id", member === first ? second.clinic_id : first.clinic_id);
        if (ownPatients.error || !ownPatients.data.length || foreignPatients.error || foreignPatients.data.length) throw new Error("Restored encrypted patient isolation failed.");
      }
      clients.push(client);
    }
    const document = snapshot.tables.find(t => t.name === (encrypted ? "private.patient_documents" : "public.patient_documents")).rows.find(d => d.clinic_id === first.clinic_id && !d.archived_at);
    const object = snapshot.objects.find(o => o.name === document?.object_path);
    if (!object) throw new Error("Restored private document fixture required.");
    const ownDownload = await clients[0].storage.from(object.bucket).download(object.name);
    if (ownDownload.error || snapshotHash(Buffer.from(await ownDownload.data.arrayBuffer())) !== (recoveredFileHashes.get(object.name) ?? object.sha256)) throw new Error("Restored owner download failed.");
    if (!(await clients[1].storage.from(object.bucket).download(object.name)).error) throw new Error("Foreign restored account downloaded a file.");
    const anonymous = createClient(runtime.API_URL, runtime.ANON_KEY, options);
    if (!(await anonymous.storage.from(object.bucket).download(object.name)).error) throw new Error("Anonymous restored account downloaded a file.");
    if ((await clients[1].rpc("authorize_document_download", { cid: first.clinic_id, document_id: document.id })).data) throw new Error("Foreign restored download RPC allowed.");
    const receipt = { ref: stagingRestoreRef, verifiedAt: new Date().toISOString(), archiveSha256: config.sha256, tablesCompared: restorable.length, filesCompared: snapshot.objects.length, authPasswordHashComparison: true, normalRestoredPasswordLogin: true, privateStorageAndTenantIsolation: true, providerMigrationHistoryRetained: true };
    fs.writeFileSync(".backups/isolated-restore.receipt.json", JSON.stringify(receipt));
    console.log("PASS: both restored accounts logged in with recovered passwords; own-clinic access and private document download passed; foreign/anonymous data and file access denied. No hosted database was changed.");
  } catch (error) {
    const safe = /^(Provider compatibility: (missing populated (table|column))|Row comparison differs:)/.test(error.message) ? ` ${error.message}` : "";
    console.error(`Isolated restore failed during ${phase}.${safe} Private diagnostics suppressed.`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await run();
