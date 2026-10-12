import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
import { managementQuery } from "../../scripts/staging-schema.mjs";
import { patientEncryptionFetch } from "../../src/lib/patient-encryption-config";
const config = stagingEnv();
process.env.PATIENT_ENCRYPTION_KEYRING = config.env.PATIENT_ENCRYPTION_KEYRING;
const actor = JSON.parse(fs.readFileSync(process.env.STAGING_PILOT_ACTOR_FILE || ".staging-deploy/pilot-actor.local.json", "utf8"));
if (actor.ref !== config.ref) throw new Error("Synthetic staging actor required.");
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: patientEncryptionFetch(config.env.NEXT_PUBLIC_SUPABASE_URL) } };

test("hosted encryption protects old/new fields, import and missing-key access", async () => {
  const admin = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.SUPABASE_SERVICE_ROLE_KEY, options);
  const owner = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, options);
  expect((await owner.auth.signInWithPassword({ email: actor.email, password: actor.password })).error).toBeNull();
  expect((await owner.rpc("session_status", { activity: false })).data.allowed).toBe(true);
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

test("public booking writes encrypted patient and appointment data through the hosted server", async ({ request }) => {
  const headers = { "x-vercel-protection-bypass": config.env.STAGING_PREVIEW_BYPASS_SECRET };
  const admin = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.SUPABASE_SERVICE_ROLE_KEY, options);
  const previous = await admin.from("clinics").select("public_booking_enabled,booking_slug").eq("id", actor.clinicId).single();
  expect(previous.error).toBeNull();
  const slug = `encryption-acceptance-${Date.now()}`;
  expect((await admin.from("clinics").update({ public_booking_enabled: true, booking_slug: slug }).eq("id", actor.clinicId)).error).toBeNull();
  const clinics = [{ slug }];
  try {
  let booking: { slug: string; service: string; slot: { start_at: string; doctor_id: string | null } } | undefined;
  for (const clinic of clinics.slice(0, 2)) {
    const catalogResponse = await request.get(`${config.origin}/api/public/catalog?clinic=${clinic.slug}`, { headers });
    expect(catalogResponse.status()).toBe(200); const catalog = await catalogResponse.json();
    for (let offset = 1; offset <= 10 && !booking; offset++) {
      const date = new Date(); date.setUTCDate(date.getUTCDate() + offset);
      if ([0, 6].includes(date.getUTCDay())) continue;
      const service = catalog.services[0]; if (!service) continue;
      const available = await request.get(`${config.origin}/api/public/availability?clinic=${clinic.slug}&service=${service.id}&date=${date.toISOString().slice(0, 10)}`, { headers });
      expect(available.status()).toBe(200); const slots = await available.json();
      if (slots.length) booking = { slug: clinic.slug, service: service.id, slot: slots[0] };
    }
    if (booking) break;
  }
  expect(Boolean(booking)).toBe(true);
  const note = "Notă complet fictivă pentru acceptarea criptării";
  const booked = await request.post(`${config.origin}/api/public/appointments`, { headers, data: { clinic: booking!.slug, service_id: booking!.service, doctor_id: booking!.slot.doctor_id, start_at: booking!.slot.start_at, name: "Pacient Fictiv Programare Criptată", email: `booking-encryption-${Date.now()}@voxa-qa.invalid`, phone: "", notes: note, consent: true, website: "", started_at: Date.now() - 2000 } });
  expect(booked.status()).toBe(201); const result = await booked.json();
  const read = await admin.from("appointments").select("patient_id,notes").eq("id", result.appointment_id).single();
  expect(read.error).toBeNull(); expect(read.data!.notes === note).toBe(true);
  const name = await admin.from("patients").select("name").eq("id", read.data!.patient_id).single();
  expect(name.error).toBeNull(); expect(name.data!.name === "Pacient Fictiv Programare Criptată").toBe(true);
  } finally {
    expect((await admin.from("clinics").update(previous.data!).eq("id", actor.clinicId)).error).toBeNull();
  }
});
