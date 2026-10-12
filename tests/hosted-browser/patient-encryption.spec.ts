import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
import { managementQuery } from "../../scripts/staging-schema.mjs";
import { patientEncryptionFetch } from "../../src/lib/patient-encryption-config";
const config = stagingEnv();
process.env.PATIENT_ENCRYPTION_KEYRING = config.env.PATIENT_ENCRYPTION_KEYRING;
const actor = JSON.parse(fs.readFileSync(".staging-deploy/pilot-actor.local.json", "utf8"));
if (actor.ref !== config.ref) throw new Error("Synthetic staging actor required.");
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: patientEncryptionFetch(config.env.NEXT_PUBLIC_SUPABASE_URL) } };

test("hosted encryption protects old/new fields, import and missing-key access", async () => {
  const admin = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.SUPABASE_SERVICE_ROLE_KEY, options);
  const owner = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, options);
  expect((await owner.auth.signInWithPassword({ email: actor.email, password: actor.password })).error).toBeNull();
  const marker = Date.now();
  const payload = { name: "Pacient Fictiv Criptare", internal_id: `ENC-${marker}`, email: `encryption-${marker}@voxa-qa.invalid`, administrative_notes: "Notă fictivă criptată" };
  const created = await owner.rpc("save_core", { cid: actor.clinicId, module: "patients", entity_id: null, payload, expected_updated_at: null });
  expect(created.error).toBeNull(); expect(typeof created.data).toBe("string");
  const read = await owner.from("patients").select("name,email,administrative_notes,updated_at").eq("id", created.data).single();
  expect(read.error).toBeNull(); expect(read.data!.name === payload.name && read.data!.email === payload.email && read.data!.administrative_notes === payload.administrative_notes).toBe(true);
  const updated = await owner.rpc("save_core", { cid: actor.clinicId, module: "patients", entity_id: created.data, payload: { ...payload, name: "Pacient Fictiv Actualizat" }, expected_updated_at: read.data!.updated_at });
  expect(updated.error).toBeNull();
  const imported = await owner.rpc("import_patients", { cid: actor.clinicId, records: [{ name: "Import Fictiv Criptat", internal_id: `ENC-IMPORT-${marker}` }], preview_only: false });
  expect(imported.error).toBeNull(); expect(imported.data.created).toBe(1);
  const noKey = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  expect((await noKey.from("patients").select("name").limit(1)).error).toBeTruthy();
  const raw = await managementQuery(config.ref, config.env.SUPABASE_ACCESS_TOKEN, "select count(*)::int as total,count(*) filter(where name='[encrypted]' and email='' and administrative_notes='' and patient_ciphertext is not null)::int as encrypted from private.patients");
  expect(Number(raw[0].total) > 0 && raw[0].total === raw[0].encrypted).toBe(true);
  const status = await admin.rpc("patient_encryption_status"); expect(status.error).toBeNull(); expect(status.data.active).toBe(true);
  // Real PostgREST embedding, rather than the local fixture adapter.
  const related = await owner.from("patient_documents").select("id,patients(name)").eq("clinic_id", actor.clinicId).limit(1);
  expect(related.error).toBeNull();
  await owner.auth.signOut({ scope: "local" });
});
