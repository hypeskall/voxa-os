import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readEnv, stagingEnv } from "./staging-env.mjs";
import { r2Settings, assertPrivateBucket, uploadEncryptedSnapshot } from "./backup-r2.mjs";
import { snapshotCodec, snapshotHash } from "./snapshot-codec.mjs";

export function backupRunConfiguration(file, source, destination) {
  if (![".env.production.local", ".env.staging.local"].includes(file)) throw new Error("Use a named source.");
  const ref = new URL(source.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const expected = file === ".env.production.local" ? "fibcbsdattoqiyizzeda" : "wlnrfjrjkyywqyvsngps";
  const origin = file === ".env.production.local" ? "https://voxa-os.vercel.app" : "https://voxa-os-staging-voxa6.vercel.app";
  if (ref !== expected || source.NEXT_PUBLIC_SUPABASE_URL !== `https://${expected}.supabase.co` || source.APP_ORIGIN !== origin
    || destination.R2_UPLOAD_APPROVED !== "true" || destination.R2_APPROVED_PROJECT_REF !== expected
    || !/^[a-f0-9]{64}$/.test(source.BACKUP_ENCRYPTION_KEY || ""))
    throw new Error("Source, destination approval or encryption key mismatch.");
  return { ref, settings:r2Settings(destination), codec:snapshotCodec(Buffer.from(source.BACKUP_ENCRYPTION_KEY,"hex"),ref) };
}

export async function executeBackup(config, io, now = () => Date.now()) {
  // Check destination privacy before capturing private database records, and
  // check it again in the upload routine immediately before transmission.
  await io.checkPrivacy(config.settings);
  await io.capture();
  const receipt = await io.readReceipt();
  const age = now() - Date.parse(receipt.createdAt);
  if (receipt.ref !== config.ref || receipt.verified !== true || !Number.isFinite(age)
    || age < -300000 || age > 3600000 || !/^[a-f0-9]{64}$/.test(receipt.sha256 || ""))
    throw new Error("Fresh matching capture receipt required.");
  const bytes = await io.readArchive(receipt.path);
  const snapshot = config.codec.open(bytes);
  if (snapshot.createdAt !== receipt.createdAt || snapshotHash(bytes) !== receipt.sha256)
    throw new Error("Capture receipt does not match the encrypted archive.");
  const verified = await io.upload(config.settings,bytes,config.codec);
  if (verified.verified !== true || verified.ref !== config.ref || verified.sha256 !== receipt.sha256)
    throw new Error("External verification receipt mismatch.");
  await io.writeReceipt(verified);
  return verified;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let phase = "configuration";
  try {
    const file = process.env.RECOVERY_ENV_FILE || ".env.production.local";
    if (![".env.production.local", ".env.staging.local"].includes(file)) throw new Error("Invalid source.");
    const source = file === ".env.staging.local" ? stagingEnv().env : readEnv(file);
    const config = backupRunConfiguration(file,source,readEnv(".env.backup.local"));
    phase = "capture and encrypted external verification";
    await executeBackup(config, {
      checkPrivacy:assertPrivateBucket,
      capture:() => {
        const child=spawnSync(process.execPath,["scripts/recovery-snapshot.mjs","capture"],{
          cwd:process.cwd(),env:{...process.env,RECOVERY_ENV_FILE:file},timeout:240000,stdio:"ignore",windowsHide:true,
        });
        if(child.error || child.status !== 0) throw new Error("Capture failed.");
      },
      readReceipt:() => JSON.parse(fs.readFileSync(`.backups/${file === ".env.production.local" ? "pre-upgrade" : "staging"}.receipt.json`,"utf8")),
      readArchive:filename => {
        const folder=fs.realpathSync(".backups");
        if(typeof filename !== "string" || !filename.endsWith(".voxa") || path.dirname(fs.realpathSync(filename)) !== folder)
          throw new Error("Unexpected archive path.");
        return fs.readFileSync(filename);
      },
      upload:uploadEncryptedSnapshot,
      writeReceipt:receipt => fs.writeFileSync(`.backups/${config.ref}.external.receipt.json`,JSON.stringify(receipt)),
    });
    console.log("PASS: fresh encrypted backup captured, transferred and downloaded with matching SHA-256. Scheduling and full hosted restore are separate checks.");
  } catch {
    console.error(`Backup run failed during ${phase}; private data and provider diagnostics suppressed.`);
    process.exitCode=1;
  }
}
