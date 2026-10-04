import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

export const snapshotHash = bytes => createHash("sha256").update(bytes).digest("hex");
const prefix = Buffer.from("VOXA-SNAPSHOT-1\n");

export function snapshotCodec(key, ref) {
  if (!Buffer.isBuffer(key) || key.length !== 32 || !/^[a-z]{20}$/.test(ref))
    throw new Error("Invalid snapshot key or target.");
  function verify(snapshot) {
    if (snapshot.ref !== ref || snapshot.format !== 1 || !Array.isArray(snapshot.tables) || !Array.isArray(snapshot.objects))
      throw new Error("Snapshot target or format mismatch.");
    for (const object of snapshot.objects) {
      const bytes = Buffer.from(object.content, "base64");
      if (bytes.length !== object.size || snapshotHash(bytes) !== object.sha256)
        throw new Error("Stored file integrity failed.");
    }
    if (snapshot.tables.some(table => !/^(public|private|auth)\.[a-z0-9_]+$/.test(table.name) || !Array.isArray(table.rows)))
      throw new Error("Invalid table inventory.");
  }
  function seal(snapshot) {
    verify(snapshot);
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(snapshot)))), cipher.final()]);
    return Buffer.concat([prefix, iv, cipher.getAuthTag(), ciphertext]);
  }
  function open(bytes) {
    if (bytes.length < prefix.length + 29 || !bytes.subarray(0, prefix.length).equals(prefix))
      throw new Error("Unknown snapshot format.");
    const offset = prefix.length, decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(offset, offset + 12));
    decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28));
    const snapshot = JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()]), { maxOutputLength: 128 * 1024 * 1024 }).toString());
    verify(snapshot);
    return snapshot;
  }
  return { seal, open, verify };
}
