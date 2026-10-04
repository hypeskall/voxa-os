import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { readEnv, stagingEnv } from "./staging-env.mjs";
import { snapshotCodec, snapshotHash } from "./snapshot-codec.mjs";

export function r2Settings(env) {
  if (!/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID || "")
    || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.R2_BUCKET || "")
    || env.R2_JURISDICTION !== "eu"
    || !/^[a-f0-9]{32}$/.test(env.R2_ACCESS_KEY_ID || "")
    || !/^[a-f0-9]{64}$/.test(env.R2_SECRET_ACCESS_KEY || "")
    || !/^[A-Za-z0-9_-]{32,256}$/.test(env.CLOUDFLARE_API_TOKEN || "")
    || /replace|placeholder/i.test(env.CLOUDFLARE_API_TOKEN || ""))
    throw new Error("Complete the private EU R2 configuration.");
  return {
    account: env.R2_ACCOUNT_ID, bucket: env.R2_BUCKET, token: env.CLOUDFLARE_API_TOKEN,
    endpoint: `https://${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  };
}

export async function assertPrivateBucket(settings, fetcher = fetch) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${settings.account}/r2/buckets/${settings.bucket}/domains/`;
  async function read(kind) {
    const response = await fetcher(base + kind, {
      headers: { Authorization: `Bearer ${settings.token}`, "cf-r2-jurisdiction": "eu" },
      redirect: "error", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Bucket privacy readback unavailable.");
    const data = await response.json();
    if (data.success !== true || !data.result) throw new Error("Unknown bucket privacy state.");
    return data.result;
  }
  const [managed, custom] = await Promise.all([read("managed"), read("custom")]);
  if (managed.enabled !== false || !Array.isArray(custom.domains)
    || custom.domains.some(domain => domain.enabled !== false))
    throw new Error("Public or unverified buckets cannot receive backups.");
}

export async function uploadEncryptedSnapshot(settings, bytes, codec, { fetcher = fetch } = {}) {
  // Decrypt/authenticate locally before any outbound request. Plaintext is never uploaded.
  if (!Buffer.isBuffer(bytes) || bytes.length > 100 * 1024 * 1024)
    throw new Error("Snapshot exceeds this small-dataset transfer tool.");
  const snapshot = codec.open(bytes);
  if (!Number.isFinite(Date.parse(snapshot.createdAt))) throw new Error("Invalid snapshot date.");
  const sha256 = snapshotHash(bytes);
  const objectKey = `voxa/${snapshot.ref}/${new Date(snapshot.createdAt).toISOString().slice(0, 10)}/${sha256}.voxa`;
  await assertPrivateBucket(settings, fetcher);
  const aws = new AwsClient({ accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey, service: "s3", region: "auto", retries: 0 });
  const url = `${settings.endpoint}/${settings.bucket}/${objectKey}`;
  async function request(method, headers = {}, body) {
    const signed = await aws.sign(url, { method, headers, ...(body ? { body } : {}), redirect: "error", signal: AbortSignal.timeout(60000) });
    return fetcher(signed);
  }
  let head = await request("HEAD");
  if (head.status === 404) {
    await head.body?.cancel();
    const put = await request("PUT", {
      "Content-Type": "application/octet-stream", "Cache-Control": "no-store",
      "x-amz-storage-class": "STANDARD",
      "x-amz-meta-sha256": sha256, "If-None-Match": "*",
    }, bytes);
    await put.body?.cancel();
    if (!put.ok && put.status !== 412) throw new Error("Encrypted upload failed.");
    head = await request("HEAD");
  }
  await head.body?.cancel();
  if (!head.ok || head.headers.get("content-length") !== String(bytes.length)
    || head.headers.get("x-amz-meta-sha256") !== sha256)
    throw new Error("Uploaded metadata verification failed.");
  const download = await request("GET");
  if (!download.ok || !download.body) throw new Error("Backup download verification failed.");
  const reader = download.body.getReader();
  const digest = createHash("sha256");
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > bytes.length) throw new Error("Backup download exceeds expected size.");
      digest.update(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (length !== bytes.length || digest.digest("hex") !== sha256)
    throw new Error("Downloaded backup integrity failed.");
  return { provider: "cloudflare-r2", account: settings.account, bucket: settings.bucket, jurisdiction: "eu", ref: snapshot.ref, objectKey, sha256, bytes: bytes.length, verifiedAt: new Date().toISOString(), verified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let phase = "configuration";
  try {
    const env = readEnv(".env.backup.local");
    const settings = r2Settings(env);
    const mode = process.argv[2];
    if (mode === "check") {
      phase = "bucket privacy";
      await assertPrivateBucket(settings);
      console.log("PASS: EU backup bucket has no enabled public domains. Upload/schedule remain separate checks.");
    } else if (mode === "upload") {
      if (env.R2_UPLOAD_APPROVED !== "true") throw new Error("Destination approval is required.");
      const file = process.env.RECOVERY_ENV_FILE || ".env.production.local";
      if (![".env.production.local", ".env.staging.local"].includes(file)) throw new Error("Use a named environment.");
      const source = file === ".env.staging.local" ? stagingEnv().env : readEnv(file);
      const ref = new URL(source.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
      if (file === ".env.production.local" && (ref !== "fibcbsdattoqiyizzeda" || source.APP_ORIGIN !== "https://voxa-os.vercel.app"))
        throw new Error("Production target mismatch.");
      if (env.R2_APPROVED_PROJECT_REF !== ref || !/^[a-f0-9]{64}$/.test(source.BACKUP_ENCRYPTION_KEY || ""))
        throw new Error("Approved project/key mismatch.");
      const filename = process.argv[3];
      const folder = fs.realpathSync(".backups");
      if (!filename || !filename.endsWith(".voxa") || path.dirname(fs.realpathSync(filename)) !== folder)
        throw new Error("Select an encrypted local snapshot.");
      phase = "encrypted transfer and download verification";
      const receipt = await uploadEncryptedSnapshot(settings, fs.readFileSync(filename), snapshotCodec(Buffer.from(source.BACKUP_ENCRYPTION_KEY, "hex"), ref));
      fs.writeFileSync(`.backups/${ref}.external.receipt.json`, JSON.stringify(receipt));
      console.log("PASS: encrypted off-device snapshot downloaded and SHA-256 verified. This does not prove full hosted restoration or a running schedule.");
    } else throw new Error("Use check or upload SNAPSHOT.");
  } catch {
    console.error(`Backup setup failed during ${phase}; credentials and provider diagnostics suppressed.`);
    process.exitCode = 1;
  }
}
