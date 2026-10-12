import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
import { managementQuery } from "../../scripts/staging-schema.mjs";
import { patientEncryptionFetch } from "../../src/lib/patient-encryption-config";
const config = stagingEnv();
process.env.PATIENT_ENCRYPTION_KEYRING = config.env.PATIENT_ENCRYPTION_KEYRING;
const actor = JSON.parse(fs.readFileSync(process.env.STAGING_PILOT_ACTOR_FILE || ".staging-deploy/pilot-actor.local.json", "utf8"));
if (actor.ref !== config.ref || !actor.email.endsWith("@voxa-qa.invalid") || !/^[a-f0-9-]{36}$/.test(actor.userId)) throw new Error("Dedicated synthetic staging actor required");
const headers: Record<string, string> = config.env.STAGING_PREVIEW_BYPASS_SECRET ? { "x-vercel-protection-bypass": config.env.STAGING_PREVIEW_BYPASS_SECRET } : {};
function client() {
  return createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: patientEncryptionFetch(config.env.NEXT_PUBLIC_SUPABASE_URL) } });
}
async function query(sql: string) { return managementQuery(config.ref, config.env.SUPABASE_ACCESS_TOKEN, sql); }
async function mutateSyntheticSession(sql: string) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${config.ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${config.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: false }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Synthetic session fixture failed (HTTP ${response.status}); diagnostics suppressed`);
}
async function age(sid: string, minutes: number, startedMinutes = 0) {
  if (!/^[a-f0-9-]{36}$/.test(sid) || ![0, 6, 11, 481].includes(minutes) || ![0, 6, 481].includes(startedMinutes)) throw new Error("Unsafe synthetic session fixture");
  await mutateSyntheticSession(`update private.session_activity set last_activity_at=now()-interval '${minutes} minutes',started_at=now()-interval '${startedMinutes} minutes' where session_id='${sid}' and user_id='${actor.userId}'`);
}
test("hosted idle, absolute and revoked sessions deny direct database access", async () => {
  for (const kind of ["idle", "absolute", "revoked"] as const) {
    const owner = client();
    try {
      const login = await owner.auth.signInWithPassword({ email: actor.email, password: actor.password });
      expect(Boolean(login.error)).toBe(false);
      expect(login.data.user?.id === actor.userId).toBe(true);
      const sid = JSON.parse(Buffer.from(login.data.session!.access_token.split(".")[1], "base64url").toString()).session_id;
      if (!/^[a-f0-9-]{36}$/.test(sid)) throw new Error("Invalid synthetic session ID");
      const status = await owner.rpc("session_status", { activity: false });
      expect(status.error).toBeNull(); expect(status.data.allowed).toBe(true);
      expect((await owner.from("clinics").select("id").eq("id", actor.clinicId)).data?.length).toBe(1);
      if (kind === "revoked") {
        await mutateSyntheticSession(`delete from auth.sessions where id='${sid}' and user_id='${actor.userId}'`);
      } else await age(sid, kind === "idle" ? 11 : 0, kind === "absolute" ? 481 : 0);
      expect((await owner.from("clinics").select("id").eq("id", actor.clinicId)).data).toEqual([]);
      expect((await owner.rpc("session_status", { activity: true })).data.allowed).toBe(false);
      expect((await owner.rpc("session_status", { activity: true })).data.allowed).toBe(false);
      expect(Boolean((await owner.rpc("record_login")).error)).toBe(true);
    } finally { await owner.auth.signOut({ scope: "local" }); }
  }
});
test("hosted export requires password confirmation and expired pages lock", async ({ page, context }) => {
  if (config.env.STAGING_PREVIEW_BYPASS_SECRET) await context.route(`${config.origin}/**`, route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  const owner = client();
  try {
    expect(Boolean((await owner.auth.signInWithPassword({ email: actor.email, password: actor.password })).error)).toBe(false);
    expect((await owner.rpc("session_status", { activity: false })).data.allowed).toBe(true);
    expect((await owner.auth.mfa.listFactors()).data?.all.length).toBe(0);
    const patient = await owner.from("patients").select("id").eq("clinic_id", actor.clinicId).is("archived_at", null).limit(1).single();
    expect(patient.error).toBeNull();
    await page.goto("/login");
    await page.getByLabel("Utilizator").fill(actor.email);
    await page.getByLabel("Parolă", { exact: true }).fill(actor.password);
    await page.getByRole("button", { name: "Conectare", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto(`/clinics/${actor.clinicId}`);
    const sessions = await query(`select id from auth.sessions where user_id='${actor.userId}' order by created_at desc limit 1`);
    await age(String(sessions[0].id), 0, 6);
    const path = `/api/clinics/${actor.clinicId}/patients/${patient.data!.id}/export`;
    const response = await page.request.get(path, { headers, maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/auth/reauthenticate");
    await page.goto(response.headers().location);
    await expect(page.getByRole("heading", { name: "Confirmă accesul" })).toBeVisible();
    await page.getByLabel("Parolă", { exact: true }).fill("incorrect-synthetic-password");
    await page.getByRole("button", { name: "Confirmă parola", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Parola nu a putut fi confirmată" })).toBeVisible();
    await page.getByLabel("Parolă", { exact: true }).fill(actor.password);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Confirmă parola", exact: true }).click();
    expect(await (await downloaded).failure()).toBeNull();
    await page.goto(`/clinics/${actor.clinicId}`);
    const fresh = await query(`select id from auth.sessions where user_id='${actor.userId}' order by created_at desc limit 1`);
    await age(String(fresh[0].id), 11);
    await page.goto(`/clinics/${actor.clinicId}/patients`);
    await expect(page).toHaveURL(/\/login\?expired=1/);
    await expect(page.getByRole("status")).toContainText("expirat");
  } finally { await owner.auth.signOut({ scope: "local" }); }
});
