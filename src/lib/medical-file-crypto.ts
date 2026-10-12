import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { patientKeyring } from "./patient-encryption-config.ts";
import { MAX_MEDICAL_ENVELOPE_BYTES, MAX_MEDICAL_PLAINTEXT_BYTES, MEDICAL_FILE_PREFIX, medicalEnvelopeAad, medicalFileContext, packMedicalEnvelope, type PreparedMedicalEncryption } from "./medical-file-format.ts";

const headerSchema = z.object({ version: z.literal(1), keyId: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/), wrappedKey: z.string().max(100), iv: z.string().max(24) }).strict();
function context(path: string) {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 if (!url || !path || path.includes("..")) throw new Error("Medical encryption target unavailable.");
 return medicalFileContext(new URL(url).origin, path);
}
function encrypt(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: string) {
 const cipher = createCipheriv("aes-256-gcm", key, iv);
 cipher.setAAD(Buffer.from(aad));
 return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
}
function decrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: string) {
 if (iv.length !== 12 || ciphertext.length < 16) throw new Error("Invalid encrypted medical file.");
 const bytes = Buffer.from(ciphertext);
 const cipher = createDecipheriv("aes-256-gcm", key, iv);
 cipher.setAAD(Buffer.from(aad));
 cipher.setAuthTag(bytes.subarray(-16));
 return Buffer.concat([cipher.update(bytes.subarray(0, -16)), cipher.final()]);
}
export function prepareMedicalEncryption(path: string): PreparedMedicalEncryption {
 const ring = patientKeyring();
 const key = randomBytes(32), wrapIv = randomBytes(12);
 const aad = context(path);
 const wrapped = encrypt(key, Buffer.from(ring.keys[ring.active], "hex"), wrapIv, `${aad}:key:${ring.active}`);
 return { key: key.toString("base64"), context: aad, header: { version: 1, keyId: ring.active, wrappedKey: Buffer.concat([wrapIv, wrapped]).toString("base64"), iv: randomBytes(12).toString("base64") } };
}
export function encryptMedicalBytes(bytes: Uint8Array, path: string) {
 if (!bytes.length || bytes.length > MAX_MEDICAL_PLAINTEXT_BYTES) throw new Error("Invalid medical file size.");
 const prepared = prepareMedicalEncryption(path);
 return packMedicalEnvelope(prepared.header, encrypt(bytes, Buffer.from(prepared.key, "base64"), Buffer.from(prepared.header.iv, "base64"), medicalEnvelopeAad(prepared.context, prepared.header)));
}
export function isEncryptedMedicalFile(bytes: Uint8Array) {
 return Buffer.from(bytes.subarray(0, MEDICAL_FILE_PREFIX.length)).equals(Buffer.from(MEDICAL_FILE_PREFIX));
}
export function decryptMedicalBytes(bytes: Uint8Array, path: string) {
 try {
  if (!isEncryptedMedicalFile(bytes)) {
   if (process.env.PATIENT_ENCRYPTION_READ_LEGACY === "true" && !path.endsWith(".enc") && bytes.length <= MAX_MEDICAL_PLAINTEXT_BYTES) return Buffer.from(bytes);
   throw new Error("Unencrypted medical file rejected.");
  }
  if (bytes.length > MAX_MEDICAL_ENVELOPE_BYTES || bytes.length < MEDICAL_FILE_PREFIX.length + 4) throw new Error();
  const buffer = Buffer.from(bytes);
  const length = buffer.readUInt32BE(MEDICAL_FILE_PREFIX.length);
  if (length < 1 || length > 2048 || buffer.length < MEDICAL_FILE_PREFIX.length + 4 + length + 16) throw new Error();
  const offset = MEDICAL_FILE_PREFIX.length + 4;
  const header = headerSchema.parse(JSON.parse(buffer.subarray(offset, offset + length).toString("utf8")));
  const master = patientKeyring().keys[header.keyId];
  if (!master) throw new Error();
  const aad = context(path), wrapped = Buffer.from(header.wrappedKey, "base64");
  if (wrapped.length !== 60) throw new Error();
  const key = decrypt(wrapped.subarray(12), Buffer.from(master, "hex"), wrapped.subarray(0, 12), `${aad}:key:${header.keyId}`);
  if (key.length !== 32) throw new Error();
  const plaintext = decrypt(buffer.subarray(offset + length), key, Buffer.from(header.iv, "base64"), medicalEnvelopeAad(aad, header));
  if (!plaintext.length || plaintext.length > MAX_MEDICAL_PLAINTEXT_BYTES) throw new Error();
  return plaintext;
 } catch {
  throw new Error("Medical file encryption integrity check failed.");
 }
}
