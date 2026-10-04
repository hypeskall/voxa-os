import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
import { totp } from "../support/totp";
const config = stagingEnv();
const actors = JSON.parse(fs.readFileSync(".staging-actors.local.json", "utf8"));
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

test("real TOTP enrollment, stale AAL1 denial, wrong code, recovery gate, re-login and removal", async ({ page, context, request }) => {
  test.setTimeout(180000);
  const headers: Record<string,string> = config.env.STAGING_PREVIEW_BYPASS_SECRET ? {"x-vercel-protection-bypass":config.env.STAGING_PREVIEW_BYPASS_SECRET} : {};
  if (config.env.STAGING_PREVIEW_BYPASS_SECRET) await context.route(`${config.origin}/**`, route => route.continue({headers:{...route.request().headers(),...headers}}));
  const marker = await request.get("/api/staging/status", {headers});
  const state = await marker.json();
  expect(state.environment === "staging" && state.supabaseProjectRef === config.ref).toBe(true);
  const client = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.publicKey, options);
  const admin = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.SUPABASE_SERVICE_ROLE_KEY, options);
  const login = await client.auth.signInWithPassword({email:actors.b.email,password:actors.b.password});
  expect(Boolean(login.error)).toBe(false);
  const userId = login.data.user!.id;
  const original = await client.auth.mfa.listFactors();
  expect(original.error).toBeNull(); expect(original.data!.all.length, "Only enroll on an unfactored synthetic account").toBe(0);
  let factorId: string | undefined;
  try {
    await page.goto("/login"); await page.getByLabel("Utilizator").fill(actors.b.email); await page.getByLabel("Parolă",{exact:true}).fill(actors.b.password); await page.getByRole("button",{name:"Conectare",exact:true}).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto("/account/security");
    for (const width of [390,1440]) {
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.getByRole("button",{name:"Configurează aplicația",exact:true}).click();
    await expect(page.getByLabel("Cheie de configurare")).toBeVisible();
    const secret = await page.getByLabel("Cheie de configurare").inputValue();
    expect(/^[A-Z2-7]+=*$/.test(secret)).toBe(true);
    factorId = await page.locator('input[name="factor_id"]').inputValue();
    await page.getByLabel("Cod de verificare").fill(totp(secret)); await page.getByRole("button",{name:"Verifică codul",exact:true}).click();
    await expect(page.getByRole("status").filter({hasText:"Aplicație de autentificare activă."})).toBeVisible();
    const staleRead = await client.from("clinics").select("id");
    expect(staleRead.error).toBeNull(); expect(staleRead.data).toEqual([]);
    expect(Boolean((await client.rpc("record_login")).error)).toBe(true);
    const documents = await admin.from("patient_documents").select("id,object_path").eq("clinic_id",actors.b.clinicId).is("archived_at",null).limit(1);
    expect(documents.error).toBeNull(); expect(documents.data?.length).toBe(1);
    const privateDocument = documents.data![0];
    expect(Boolean((await client.storage.from("voxa-medical").download(privateDocument.object_path)).error)).toBe(true);
    await page.goto(`/clinics/${actors.b.clinicId}`); await page.getByRole("button",{name:"Deconectare",exact:true}).click(); await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Utilizator").fill(actors.b.email); await page.getByLabel("Parolă",{exact:true}).fill(actors.b.password); await page.getByRole("button",{name:"Conectare",exact:true}).click();
    await expect(page).toHaveURL(/\/auth\/mfa/);
    await page.goto("/reset-password"); await expect(page).toHaveURL(/\/auth\/mfa\?next=%2Freset-password/);
    const routeDownload = await page.request.get(`/api/clinics/${actors.b.clinicId}/documents/${privateDocument.id}/download`, {headers,maxRedirects:0});
    expect(routeDownload.status()).toBe(403);
    const current = totp(secret); const wrong = current === "000000" ? "000001" : "000000";
    await page.getByLabel("Cod de verificare").fill(wrong); await page.getByRole("button",{name:"Verifică codul",exact:true}).click();
    await expect(page.getByRole("alert").filter({hasText:"Codul nu este valid"})).toBeVisible();
    await page.getByLabel("Cod de verificare").fill(totp(secret)); await page.getByRole("button",{name:"Verifică codul",exact:true}).click();
    await expect(page).toHaveURL(`${config.origin}/reset-password`);
    await page.goto("/account/security");
    await page.getByRole("checkbox").check(); await page.getByRole("button",{name:"Dezactivează verificarea",exact:true}).click();
    await expect(page.getByRole("status")).toContainText("a fost dezactivată");
    await page.goto(`/clinics/${actors.b.clinicId}`); await expect(page.locator(".app-shell")).toBeVisible();
    const remaining = await admin.auth.admin.mfa.listFactors({userId});
    expect(remaining.error).toBeNull(); expect(remaining.data!.factors).toHaveLength(0);
    factorId = undefined;
    console.log("PASS: real hosted MFA enrollment/challenge/removal; stale AAL1 table/RPC/file access and recovery bypass denied.");
  } finally {
    if (factorId) {
      const cleanup = await admin.auth.admin.mfa.deleteFactor({userId,id:factorId});
      expect(Boolean(cleanup.error), "Remove only this test's disposable factor").toBe(false);
    }
    await client.auth.signOut({scope:"local"});
  }
});
