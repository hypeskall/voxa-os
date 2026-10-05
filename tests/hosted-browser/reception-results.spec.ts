import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";

const config = stagingEnv();
const actor = JSON.parse(fs.readFileSync(".staging-deploy/pilot-actor.local.json", "utf8"));
const pilot = JSON.parse(fs.readFileSync(".staging-deploy/pilot-acceptance.receipt.json", "utf8"));
if (actor.ref !== config.ref || pilot.ref !== config.ref || actor.clinicId !== pilot.clinicId) throw new Error("Separate synthetic clinic required.");

test("real reception upload appears only in the linked patient's portal and downloads the original PDF", async ({ page, context, browser }) => {
  test.setTimeout(180000);
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.SUPABASE_SERVICE_ROLE_KEY, options);
  const owner = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, options);
  expect((await owner.auth.signInWithPassword({ email: actor.email, password: actor.password })).error).toBeNull();
  const users: string[] = [];
  const contexts = [];
  const marker = Date.now();
  const base = `/clinics/${actor.clinicId}`;
  const headers: Record<string, string> = config.env.STAGING_PREVIEW_BYPASS_SECRET ? { "x-vercel-protection-bypass": config.env.STAGING_PREVIEW_BYPASS_SECRET } : {};
  const protect = async (target: typeof context) => { await target.route(`${config.origin}/**`, route => route.continue({ headers: { ...route.request().headers(), ...headers } })); };
  await protect(context);
  const status = await page.request.get(`${config.origin}/api/staging/status`, { headers });
  expect((await status.json()).supabaseProjectRef).toBe(config.ref);
  const createUser = async (prefix: string) => {
    const email = `${prefix}-${marker}@voxa-qa.invalid`, password = randomBytes(32).toString("base64url");
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(result.error).toBeNull(); users.push(result.data.user!.id);
    return { email, password, id: result.data.user!.id };
  };
  try {
    const reception = await createUser("reception-results");
    const patient = await createUser("portal-results");
    const outsider = await createUser("portal-other");
    expect((await owner.rpc("set_membership", { cid: actor.clinicId, target_email: reception.email, target_role: "RECEPTION", is_active: true })).error).toBeNull();
    expect((await owner.rpc("link_patient_identity", { cid: actor.clinicId, pid: pilot.patientId, uid: patient.id })).error).toBeNull();
    const otherPatient = await owner.rpc("save_core", { cid: actor.clinicId, module: "patients", entity_id: null, payload: { name: "Alt Pacient Fictiv Audit", internal_id: `AUDIT-${marker}`, email: outsider.email }, expected_updated_at: null });
    expect(otherPatient.error).toBeNull(); expect(typeof otherPatient.data).toBe("string");
    expect((await owner.rpc("link_patient_identity", { cid: actor.clinicId, pid: otherPatient.data, uid: outsider.id })).error).toBeNull();
    const appointment = await owner.from("appointments").select("id,doctor_location_id").eq("clinic_id", actor.clinicId).eq("patient_id", pilot.patientId).limit(1).single();
    expect(appointment.error).toBeNull();
    const draftTitle = `Ciornă medicală audit ${marker}`;
    const existing = await owner.from("medical_results").select("id,version").eq("clinic_id", actor.clinicId).eq("appointment_id", appointment.data!.id).maybeSingle();
    expect(existing.error).toBeNull();
    const draft = await owner.rpc("save_medical_result", { cid: actor.clinicId, result_id: existing.data?.id ?? null, aid: appointment.data!.id, did: appointment.data!.doctor_location_id, result_title: draftTitle, result_content: "Conținut fictiv în lucru.", expected_version: existing.data?.version ?? null, change_reason: "Audit repetat pe date fictive" });
    expect(draft.error).toBeNull();
    await page.goto(`${config.origin}/login`);
    await page.getByLabel("Utilizator").fill(reception.email);
    await page.getByLabel("Parolă", { exact: true }).fill(reception.password);
    await page.getByRole("button", { name: "Conectare", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Spațiul de lucru", exact: true })).toBeVisible();
    await page.goto(`${config.origin}${base}/patients/${pilot.patientId}?tab=results`);
    await expect(page.getByRole("heading", { name: "Rezultate medicale", exact: true })).toBeVisible();
    await page.getByRole("link", { name: draftTitle, exact: true }).click();
    await expect(page.getByRole("heading", { name: draftTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validează", exact: true })).toHaveCount(0);
    await page.goto(`${config.origin}${base}/patients/${pilot.patientId}?tab=results`);
    const title = `Rezultat PDF audit ${marker}`;
    await page.getByRole("button", { name: "Încarcă rezultat", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Titlu rezultat", { exact: true }).fill(title);
    await dialog.getByLabel("Fișier rezultat", { exact: true }).setInputFiles(".staging-deploy/fixtures/voxa-synthetic-b.pdf");
    await expect(dialog.getByRole("checkbox", { name: "Vizibil în portalul pacientului", exact: true })).toBeChecked();
    await dialog.getByRole("button", { name: "Încarcă rezultatul", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const docs = await owner.rpc("list_patient_result_uploads", { cid: actor.clinicId, pid: pilot.patientId });
    expect(docs.error).toBeNull();
    const document = (docs.data as { id: string; title: string }[]).find(d => d.title === title)!;
    expect(document).toBeTruthy();
    const portalContext = await browser.newContext(); contexts.push(portalContext); await protect(portalContext);
    const portalPage = await portalContext.newPage();
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: patient.email });
    expect(link.error).toBeNull();
    const callback = new URL("/auth/callback", config.origin);
    callback.searchParams.set("token_hash", link.data.properties!.hashed_token);
    callback.searchParams.set("type", "magiclink"); callback.searchParams.set("next", "/portal");
    await portalPage.goto(callback.toString());
    await expect(portalPage).toHaveURL(`${config.origin}/portal`);
    await expect(portalPage.locator("#rezultate").getByText(title, { exact: true })).toBeVisible();
    await expect(portalPage.getByText(draftTitle, { exact: true })).toHaveCount(0);
    await expect(portalPage.locator("#documente").getByText(title, { exact: true })).toHaveCount(0);
    const download = await portalPage.request.get(`${config.origin}/api/clinics/${actor.clinicId}/documents/${document.id}/download`, { headers, maxRedirects: 0 });
    expect(download.status()).toBe(307);
    const original = await portalPage.request.get(download.headers().location);
    expect(original.status()).toBe(200);
    expect((await original.body()).equals(fs.readFileSync(".staging-deploy/fixtures/voxa-synthetic-b.pdf"))).toBe(true);
    const foreign = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, options);
    expect((await foreign.auth.signInWithPassword(outsider)).error).toBeNull();
    expect((await foreign.rpc("list_patient_result_uploads", { cid: actor.clinicId, pid: pilot.patientId })).error).toBeTruthy();
    expect((await foreign.rpc("authorize_document_download", { cid: actor.clinicId, document_id: document.id })).error).toBeTruthy();
    await portalPage.screenshot({ path: ".staging-deploy/results-portal-proof.png", fullPage: true });
    fs.writeFileSync(".staging-deploy/reception-results.receipt.json", JSON.stringify({ verifiedAt: new Date().toISOString(), ref: config.ref, clinicId: actor.clinicId, receptionDraftRead: true, receptionUpload: true, patientPortalRead: true, originalPdfDownload: true, foreignPatientDenied: true }, null, 2));
    await foreign.auth.signOut({ scope: "local" });
  } finally {
    for (const target of contexts) await target.close();
    // Retain auditable synthetic records while revoking every temporary identity.
    for (const id of users) {
      expect((await admin.from("clinic_memberships").update({ active: false }).eq("user_id", id).eq("clinic_id", actor.clinicId)).error).toBeNull();
      expect((await admin.from("patient_identities").update({ revoked_at: new Date().toISOString() }).eq("user_id", id).eq("clinic_id", actor.clinicId)).error).toBeNull();
      expect((await admin.auth.admin.updateUserById(id, { ban_duration: "87600h" })).error).toBeNull();
    }
    await owner.auth.signOut({ scope: "local" });
  }
});
