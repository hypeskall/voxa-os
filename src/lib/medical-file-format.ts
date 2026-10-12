// Shared wire format only: this module contains no master key or Node imports.
export const MEDICAL_FILE_PREFIX = "VOXA-MEDICAL-1\n";
export const MAX_MEDICAL_PLAINTEXT_BYTES = 20 * 1024 * 1024;
export const MAX_MEDICAL_ENVELOPE_BYTES = MAX_MEDICAL_PLAINTEXT_BYTES + 4096;
export type MedicalEnvelopeHeader = { version: 1; keyId: string; wrappedKey: string; iv: string };
export type PreparedMedicalEncryption = { key: string; header: MedicalEnvelopeHeader; context: string };
export function medicalFileContext(project: string, path: string) {
 return `voxa:medical:v1:${project}:voxa-medical:${path}`;
}
export function medicalEnvelopeAad(context: string, header: MedicalEnvelopeHeader) {
 return `${context}:${JSON.stringify(header)}`;
}
export function packMedicalEnvelope(header: MedicalEnvelopeHeader, encrypted: Uint8Array) {
 const prefix = new TextEncoder().encode(MEDICAL_FILE_PREFIX);
 const encoded = new TextEncoder().encode(JSON.stringify(header));
 if (encoded.length > 2048) throw new Error("Invalid encrypted medical file.");
 const result = new Uint8Array(prefix.length + 4 + encoded.length + encrypted.length);
 result.set(prefix);
 new DataView(result.buffer).setUint32(prefix.length, encoded.length);
 result.set(encoded, prefix.length + 4);
 result.set(encrypted, prefix.length + 4 + encoded.length);
 return result;
}
export async function encryptMedicalFileInBrowser(file: File, prepared: PreparedMedicalEncryption) {
 if (!file.size || file.size > MAX_MEDICAL_PLAINTEXT_BYTES) throw new Error("Invalid medical file size.");
 const fromBase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
 const key = await crypto.subtle.importKey("raw", fromBase64(prepared.key), "AES-GCM", false, ["encrypt"]);
 const bytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv: fromBase64(prepared.header.iv), additionalData: new TextEncoder().encode(medicalEnvelopeAad(prepared.context, prepared.header)), tagLength: 128 }, key, await file.arrayBuffer());
 const packed = packMedicalEnvelope(prepared.header, new Uint8Array(bytes));
 return new Blob([packed.buffer as ArrayBuffer], { type: "application/octet-stream" });
}
