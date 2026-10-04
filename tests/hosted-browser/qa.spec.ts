import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
const config = stagingEnv();
type Actor = { email: string; password: string; clinicId: string; patientId: string };
const file = process.env.STAGING_ACTORS_FILE || ".staging-actors.local.json";
if (!fs.existsSync(file)) throw new Error("Create .staging-actors.local.json after real hosted registration/email confirmation/onboarding. This suite uses no mocks.");
const actors = JSON.parse(fs.readFileSync(file, "utf8")) as { a: Actor; b: Actor };
async function signIn(page: Page, actor: Actor) {
  await page.goto("/login");
  await expect(page.locator("form")).toHaveAttribute("method","post");
  await page.getByLabel("Utilizator").fill(actor.email);
  await page.getByLabel("Parolă", { exact: true }).fill(actor.password);
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
test.beforeEach(async ({ request, context }) => {
  const bypass = config.env.STAGING_PREVIEW_BYPASS_SECRET;
  const headers: Record<string, string> = bypass ? { "x-vercel-protection-bypass": bypass } : {};
  if (bypass) await context.route(`${config.origin}/**`, route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  // Scope this credential to the staging origin, never global browser headers.
  await expect.poll(async () => {
    const response = await request.get("/api/staging/status", { headers, maxRedirects: 0 });
    if (response.status() !== 200 || !response.headers()["content-type"]?.includes("application/json")) return false;
    const marker=await response.json();
    return marker.environment==="staging" && marker.supabaseProjectRef===config.ref && marker.origin===config.origin;
  }, { timeout: 30000, message: "Authorized access must reach the exact staging configuration marker" }).toBe(true);
});
test("anonymous protected routes and invalid callback stay on staging login", async ({ page }) => {
  for (const route of ["/dashboard", "/onboarding", "/reset-password", `/clinics/${actors.a.clinicId}/patients`]) {
    await page.goto(route); await expect(page).toHaveURL(/\/login/);
  }
  await page.goto("/auth/callback?next=https://evil.invalid");
  await expect(page).toHaveURL(`${config.origin}/login?error=link`);
});
test("invalid credentials do not establish a session", async ({ page }) => {
  await page.goto("/login"); await page.getByLabel("Utilizator").fill(actors.a.email);
  await page.getByLabel("Parolă", { exact: true }).fill("Deliberately-invalid-staging-password");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Autentificarea nu a reușit" })).toBeVisible();
  await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login/);
});
test("real hosted session survives refresh and logout removes access", async ({ page, context }) => {
  await signIn(page, actors.a); await page.goto(`/clinics/${actors.a.clinicId}`);
  await expect(page.getByRole("heading", { name: "Spațiul de lucru" })).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", { name: "Spațiul de lucru" })).toBeVisible();
  const cookies = (await context.cookies()).filter(cookie => cookie.name.startsWith("sb-"));
  expect(cookies.length).toBeGreaterThan(0);
  expect(cookies.every(cookie => cookie.httpOnly && cookie.secure && cookie.sameSite === "Lax")).toBe(true);
  await page.getByRole("button", { name: "Deconectare", exact: true }).click(); await expect(page).toHaveURL(/\/login/);
  await page.goto(`/clinics/${actors.a.clinicId}`); await expect(page).toHaveURL(/\/login/);
});

test("real existing account can recover public entry and switch accounts", async ({ page }) => {
  await signIn(page, actors.a);
  await page.goto("/register");
  await expect(page.getByRole("status")).toContainText("Ai deja o sesiune conectată");
  await expect(page.getByLabel("Nume complet")).toHaveCount(0);
  await page.getByRole("link", { name: "Continuă în platformă" }).click();
  await expect(page.getByRole("heading", { name: "Spațiul de lucru" })).toBeVisible();
  await page.goto("/login?switch=1");
  await page.getByRole("button", { name: "Deconectează-te și schimbă contul" }).click();
  await expect(page.getByLabel("Utilizator")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
for (const [own,other] of [[actors.a,actors.b],[actors.b,actors.a]]) test(`Clinic ${own===actors.a ? "A" : "B"} cannot open the other clinic's patient IDs`, async ({ page }) => {
  await signIn(page, own);
  // Prove the actor's own real fixture renders before attempting foreign IDs.
  await page.goto(`/clinics/${own.clinicId}/patients/${own.patientId}`);
  await expect(page.getByRole("heading",{name:"Pagina nu este disponibilă"})).toHaveCount(0);
  await expect(page.locator(".app-shell")).toBeVisible();
  const response = await page.goto(`/clinics/${other.clinicId}/patients/${other.patientId}`);
  // Next.js sends 200 for a notFound response once streaming has started.
  expect([200,404]).toContain(response?.status());
  await expect(page.getByRole("heading",{name:"Pagina nu este disponibilă",exact:true})).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
});
for (const width of [1440,1024,390]) test(`hosted clinic pages and appointment dialog at ${width}px`, async ({ page }) => {
  let pageErrors = 0, serverFailures = 0, consoleFailures = 0, networkFailures = 0;
  page.on("pageerror", () => { pageErrors++; });
  page.on("console", message => { if (message.type() === "error" || (message.type() === "warning" && /react|hydration|warning/i.test(message.text()))) consoleFailures++; });
  page.on("response", response => { if (response.status() >= 400) serverFailures++; });
  page.on("requestfailed", request => { if (!request.failure()?.errorText.includes("ERR_ABORTED")) networkFailures++; });
  await page.setViewportSize({ width, height: 900 });
  await signIn(page, actors.a);
  for (const route of ["", "/calendar", "/appointments", `/patients/${actors.a.patientId}`, "/settings"]) {
    const response = await page.goto(`/clinics/${actors.a.clinicId}${route}`);
    expect(response?.status()).toBe(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto(`/clinics/${actors.a.clinicId}/calendar`);
  await page.getByRole("button", { name: "Programare nouă", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect({ pageErrors, serverFailures, consoleFailures, networkFailures }).toEqual({ pageErrors: 0, serverFailures: 0, consoleFailures: 0, networkFailures: 0 });
});
