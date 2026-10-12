import "server-only";
import { z } from "zod";

const schema = z.object({
 active: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
 keys: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/), z.string().regex(/^[a-f0-9]{64}$/)),
 index: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().refine(ring => Object.hasOwn(ring.keys, ring.active) && Object.keys(ring.keys).length <= 8 && !Object.values(ring.keys).includes(ring.index) && new Set(Object.values(ring.keys)).size === Object.keys(ring.keys).length);

export function patientKeyring() {
 try {
  return schema.parse(JSON.parse(process.env.PATIENT_ENCRYPTION_KEYRING ?? ""));
 } catch {
  // Never include parser diagnostics, submitted data or keys in errors/logs.
  throw new Error("Patient encryption is not configured correctly.");
 }
}

// The key header is attached only to the exact Data API origin/path, never to
// Auth, Storage, redirects, external notification providers or browser clients.
export function patientEncryptionFetch(url: string, baseFetch: typeof fetch = fetch): typeof fetch {
 const target = new URL(url);
 return async (input, init) => {
  const requestUrl = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  headers.delete("x-voxa-patient-keyring");
  if (requestUrl.origin === target.origin && requestUrl.pathname.startsWith("/rest/v1/")) {
   if (process.env.PATIENT_ENCRYPTION_KEYRING) {
    if (target.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(target.hostname)) throw new Error("Patient encryption requires HTTPS.");
    headers.set("x-voxa-patient-keyring", JSON.stringify(patientKeyring()));
   }
  }
  return baseFetch(input, { ...init, headers, redirect: "error", cache: "no-store" });
 };
}
