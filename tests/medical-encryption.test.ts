import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decryptMedicalBytes, encryptMedicalBytes, prepareMedicalEncryption } from "../src/lib/medical-file-crypto";
import { encryptMedicalFileInBrowser } from "../src/lib/medical-file-format";
import { patientEncryptionFetch, patientKeyring } from "../src/lib/patient-encryption-config";
import { medicalDownloadResponse } from "../src/lib/medical-download";

const ring = { active: "v1", keys: { v1: "a1".repeat(32) }, index: "b2".repeat(32) };
const path = "clinic/patient/documents/random.enc";
const plaintext = Buffer.from("%PDF-1.7 Confidential patient result");
beforeEach(() => {
 vi.stubEnv("PATIENT_ENCRYPTION_KEYRING", JSON.stringify(ring));
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
 vi.stubEnv("PATIENT_ENCRYPTION_READ_LEGACY", "false");
});
afterEach(() => vi.unstubAllEnvs());
describe("medical file encryption", () => {
 it("stores authenticated ciphertext with a different key/nonce per file", () => {
  const a = encryptMedicalBytes(plaintext, path), b = encryptMedicalBytes(plaintext, path);
  expect(Buffer.from(a)).not.toEqual(Buffer.from(b));
  expect(Buffer.from(a).toString()).not.toContain("Confidential patient");
  expect(decryptMedicalBytes(a, path)).toEqual(plaintext);
 });
 it("decrypts browser-encrypted direct uploads with the server-held master key", async () => {
  const prepared = prepareMedicalEncryption(path);
  const file = new File([plaintext], "sensitive.pdf", { type: "application/pdf" });
  const encrypted = await encryptMedicalFileInBrowser(file, prepared);
  expect(decryptMedicalBytes(new Uint8Array(await encrypted.arrayBuffer()), path)).toEqual(plaintext);
  expect(JSON.stringify(prepared)).not.toContain(ring.keys.v1);
 });
 it("rejects tampering, a different patient/path/project, and a wrong key", () => {
  const encrypted = encryptMedicalBytes(plaintext, path);
  const damaged = Uint8Array.from(encrypted); damaged[damaged.length - 1] ^= 1;
  expect(() => decryptMedicalBytes(damaged, path)).toThrow("integrity");
  expect(() => decryptMedicalBytes(encrypted, "clinic/other/documents/random.enc")).toThrow("integrity");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://different.supabase.co");
  expect(() => decryptMedicalBytes(encrypted, path)).toThrow("integrity");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("PATIENT_ENCRYPTION_KEYRING", JSON.stringify({ ...ring, keys: { v1: "c3".repeat(32) } }));
  expect(() => decryptMedicalBytes(encrypted, path)).toThrow("integrity");
 });
 it("retains old-key reads across rotation and rejects missing or malformed keys", () => {
  const encrypted = encryptMedicalBytes(plaintext, path);
  vi.stubEnv("PATIENT_ENCRYPTION_KEYRING", JSON.stringify({ ...ring, active: "v2", keys: { ...ring.keys, v2: "c3".repeat(32) } }));
  expect(decryptMedicalBytes(encrypted, path)).toEqual(plaintext);
  vi.stubEnv("PATIENT_ENCRYPTION_KEYRING", "");
  expect(() => encryptMedicalBytes(plaintext, path)).toThrow("not configured");
  expect(() => decryptMedicalBytes(encrypted, path)).toThrow("integrity");
  vi.stubEnv("PATIENT_ENCRYPTION_KEYRING", '{"active":"v1","keys":{"v1":"invalid"},"index":"bad"}');
  expect(() => patientKeyring()).toThrow("not configured");
 });
 it("rejects plaintext by default and permits it only during explicit migration", () => {
  const legacyPath = "clinic/patient/documents/old-file.pdf";
  expect(() => decryptMedicalBytes(plaintext, legacyPath)).toThrow("integrity");
  vi.stubEnv("PATIENT_ENCRYPTION_READ_LEGACY", "true");
  expect(decryptMedicalBytes(plaintext, legacyPath)).toEqual(plaintext);
  const encrypted = encryptMedicalBytes(plaintext, path);
  encrypted[0] ^= 1;
  expect(() => decryptMedicalBytes(encrypted, path)).toThrow("integrity");
 });
 it("restores encrypted files into another project by authenticating and rebinding them", () => {
  const source = encryptMedicalBytes(plaintext, path);
  const recovered = decryptMedicalBytes(source, path);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  expect(() => decryptMedicalBytes(source, path)).toThrow("integrity");
  const restored = encryptMedicalBytes(recovered, path);
  expect(decryptMedicalBytes(restored, path)).toEqual(plaintext);
 });
 it("serves plaintext only through an authorized application response without caching", async () => {
  const encrypted = encryptMedicalBytes(plaintext, path);
  const response = await medicalDownloadResponse(new Blob([Uint8Array.from(encrypted).buffer]), path, "Rezultat pacient.pdf");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(plaintext);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("content-disposition")).toContain("Rezultat%20pacient.pdf");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
 });
 it("never forwards master keys to Auth, Storage, third-party URLs or redirects", async () => {
  const calls: { url: string; headers: Headers; redirect: unknown }[] = [];
  const fake = vi.fn(async (input, init) => { calls.push({ url: String(input), headers: new Headers(init?.headers), redirect: init?.redirect }); return new Response("{}"); }) as typeof fetch;
  const request = patientEncryptionFetch("https://project.supabase.co", fake);
  for (const url of ["https://project.supabase.co/rest/v1/patients", "https://project.supabase.co/auth/v1/user", "https://project.supabase.co/storage/v1/object/voxa-medical/file", "https://evil.example/rest/v1/patients"]) await request(url, { headers: { "x-voxa-patient-keyring": "injected" } });
  expect(calls[0].headers.get("x-voxa-patient-keyring")).toBe(JSON.stringify(ring));
  expect(calls.slice(1).every(call => !call.headers.has("x-voxa-patient-keyring"))).toBe(true);
  expect(calls.every(call => call.redirect === "error")).toBe(true);
 });
});
