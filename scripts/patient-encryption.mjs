// Node 24+: run with --conditions=react-server. Keys/PHI are never printed.
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readEnv, stagingEnv } from "./staging-env.mjs";
import { snapshotCodec, snapshotHash } from "./snapshot-codec.mjs";
import { patientEncryptionFetch, patientKeyring } from "../src/lib/patient-encryption-config.ts";
import { decryptMedicalBytes, encryptMedicalBytes, isEncryptedMedicalFile } from "../src/lib/medical-file-crypto.ts";

const mode = process.argv[2], environment = process.argv[3];
let phase = "configuration";
const check = result => { if (result.error) throw new Error("Operation failed."); return result.data; };
try {
 if (!["staging", "production"].includes(environment) || !["generate", "check", "activate", "files", "verify"].includes(mode)) throw new Error("Use generate|check|activate|files|verify staging|production.");
 const keyFile = `.env.patient-encryption.${environment}.local`;
 if (mode === "generate") {
  const ring = { active: "v1", keys: { v1: randomBytes(32).toString("hex") }, index: randomBytes(32).toString("hex") };
  fs.writeFileSync(keyFile, `PATIENT_ENCRYPTION_KEYRING=${JSON.stringify(ring)}\nPATIENT_ENCRYPTION_READ_LEGACY=false\n`, { flag: "wx", mode: 0o600 });
  console.log(`Prepared ${keyFile}. Save a separate recovery copy before activation; no secrets printed and no remote change made.`);
 } else {
  const env = environment === "staging" ? stagingEnv().env : readEnv(".env.production.local");
  if (environment === "production" && env.NEXT_PUBLIC_SUPABASE_URL !== "https://fibcbsdattoqiyizzeda.supabase.co") throw new Error("Production target mismatch.");
  const saved = fs.existsSync(keyFile) ? readEnv(keyFile) : {};
  if (saved.PATIENT_ENCRYPTION_KEYRING && env.PATIENT_ENCRYPTION_KEYRING && saved.PATIENT_ENCRYPTION_KEYRING !== env.PATIENT_ENCRYPTION_KEYRING) throw new Error("Different keyrings supplied; resolve before proceeding.");
  Object.assign(process.env, env, saved);
  patientKeyring();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: patientEncryptionFetch(url) } });
  phase = "encryption status readback";
  const status = check(await client.rpc("patient_encryption_status"));
  if (mode === "check") {
   console.log(`Database encryption ${status.active ? "ACTIVE" : "NOT ACTIVE"}. Keyring validated locally; remote decryption and file coverage require verify.`);
  } else {
   if (["activate", "files"].includes(mode)) {
    // Authenticate/decrypt the actual backup, not just an unsigned receipt.
    phase = "fresh recovery archive verification";
    const receipt = JSON.parse(fs.readFileSync(`.backups/${environment === "production" ? "pre-upgrade" : "staging"}.receipt.json`, "utf8"));
    const age = Date.now() - Date.parse(receipt.createdAt);
    const ref = new URL(url).hostname.split(".")[0];
    if (!receipt.verified || receipt.ref !== ref || !Number.isFinite(age) || age < 0 || age > 3600000 || path.dirname(path.resolve(receipt.path)) !== path.resolve(".backups")) throw new Error("Fresh matching recovery archive required.");
    const bytes = fs.readFileSync(receipt.path);
    if (snapshotHash(bytes) !== receipt.sha256 || !/^[a-f0-9]{64}$/.test(env.BACKUP_ENCRYPTION_KEY || "")) throw new Error("Recovery archive integrity mismatch.");
    const snapshot = snapshotCodec(Buffer.from(env.BACKUP_ENCRYPTION_KEY, "hex"), ref).open(bytes);
    if (snapshot.createdAt !== receipt.createdAt) throw new Error("Recovery archive timestamp mismatch.");
   }
   if (mode === "activate") {
    phase = "atomic field encryption activation";
    const result = check(await client.rpc("activate_patient_encryption"));
    console.log(`Encrypted ${result.encrypted_rows} existing rows across ${result.tables} protected tables. File conversion is a separate step.`);
   } else {
    if (!status.active) throw new Error("Field encryption must be active first.");
    phase = mode === "files" ? "medical file conversion" : "medical file verification";
    // Capture the inventory before changing object names; pagination must not
    // skip objects when the list is subsequently mutated.
    const names = [];
    async function list(folder = "") {
     for (let offset = 0; ; offset += 1000) {
      const items = check(await client.storage.from("voxa-medical").list(folder, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } }));
      for (const item of items) {
       const name = folder ? `${folder}/${item.name}` : item.name;
       if (!item.id) await list(name); else names.push(name);
      }
      if (items.length < 1000) break;
     }
    }
    await list();
    let converted = 0;
    for (const name of names) {
     const source = check(await client.storage.from("voxa-medical").download(name));
     const sourceBytes = new Uint8Array(await source.arrayBuffer());
     if (isEncryptedMedicalFile(sourceBytes)) { decryptMedicalBytes(sourceBytes, name); continue; }
     if (mode === "verify") throw new Error("Unencrypted medical object remains.");
     const target = `${name.slice(0, name.lastIndexOf("/"))}/${randomUUID()}.enc`;
     const ciphertext = encryptMedicalBytes(sourceBytes, target);
     check(await client.storage.from("voxa-medical").upload(target, ciphertext, { contentType: "application/octet-stream", upsert: false, cacheControl: "0" }));
     const downloaded = check(await client.storage.from("voxa-medical").download(target));
     const recovered = decryptMedicalBytes(new Uint8Array(await downloaded.arrayBuffer()), target);
     if (recovered.length !== sourceBytes.length || !timingSafeEqual(recovered, sourceBytes)) throw new Error("Converted object failed readback.");
     check(await client.rpc("replace_encrypted_medical_path", { old_path: name, new_path: target }));
     check(await client.storage.from("voxa-medical").remove([name]));
     converted++;
    }
    // Ask the Data API to decrypt an authorized sample. A missing/mismatched
    // field key causes an error, even if file coverage happened to be empty.
    check(await client.from("patients").select("name").limit(1));
    console.log(mode === "files" ? `Converted and decrypt-verified ${converted} legacy medical objects; ${names.length} inventoried.` : `Verified ${names.length} encrypted medical objects and a patient-field read. No plaintext files accepted.`);
   }
  }
 }
} catch {
 console.error(`Patient encryption operation failed during ${phase}. Sensitive diagnostics suppressed.`);
 process.exitCode = 1;
}
