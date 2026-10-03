import { test, expect } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";

const config = stagingEnv();
test.beforeEach(async ({ request, context }) => {
  const secret = config.env.STAGING_PREVIEW_BYPASS_SECRET;
  const headers: Record<string, string> = secret ? { "x-vercel-protection-bypass": secret } : {};
  if (secret) await context.route(`${config.origin}/**`, route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  await expect.poll(async () => {
    const response = await request.get("/api/staging/status", { headers, maxRedirects: 0 });
    if (response.status() !== 200 || !response.headers()["content-type"]?.includes("application/json")) return false;
    const marker=await response.json();
    return marker.environment==="staging" && marker.supabaseProjectRef===config.ref && marker.origin===config.origin;
  }, { timeout: 30000, message: "Authorized access must reach the exact staging configuration marker" }).toBe(true);
});

test("logged-out users cannot enter protected hosted routes", async ({ page }) => {
  for (const route of ["/", "/dashboard", "/onboarding", "/reset-password", "/clinics/00000000-0000-4000-8000-000000000001/patients"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
  }
  await page.goto("/auth/callback?next=https://evil.invalid");
  await expect(page).toHaveURL(`${config.origin}/login?error=link`);
});

test("hosted Auth rejects an invalid login without creating a session", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("invalid-login@voxa-staging.invalid");
  await page.getByLabel("Parolă", { exact: true }).fill("Deliberately-invalid-staging-password");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Autentificarea nu a reușit" })).toBeVisible();
  expect((await context.cookies()).filter(cookie => cookie.name.startsWith("sb-"))).toHaveLength(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

for (const width of [1440, 1024, 390]) test(`hosted public Auth pages at ${width}px`, async ({ page }) => {
  const issues: string[] = [];
  page.on("pageerror", () => issues.push("page error"));
  page.on("console", message => { if (message.type() === "error" || (message.type() === "warning" && /react|hydration/i.test(message.text()))) issues.push(message.text().replaceAll(config.env.STAGING_PREVIEW_BYPASS_SECRET || "__no_secret__", "[redacted]")); });
  page.on("response", response => { if (response.status() >= 400) issues.push(`HTTP ${response.status()}`); });
  page.on("requestfailed", request => { if (!request.failure()?.errorText.includes("ERR_ABORTED")) { const url = new URL(request.url()); issues.push(`${url.hostname}${url.pathname}: ${request.failure()?.errorText}`); } });
  await page.setViewportSize({ width, height: 900 });
  for (const route of ["/login", "/register", "/forgot-password", `/auth/recovery?token_hash=${"a".repeat(64)}`]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("form")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(issues).toEqual([]);
});

test("hosted recovery GET waits for confirmation and reports unusable tokens clearly", async ({ page, request }) => {
  const hash="a".repeat(64);
  const headers: Record<string,string>=config.env.STAGING_PREVIEW_BYPASS_SECRET ? {"x-vercel-protection-bypass":config.env.STAGING_PREVIEW_BYPASS_SECRET}:{};
  const response=await request.get(`/auth/callback?token_hash=${hash}&type=recovery&next=https://evil.invalid`,{headers,maxRedirects:0});
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toBe(`${config.origin}/auth/recovery?token_hash=${hash}`);
  expect(response.headers()["cache-control"]).toContain("no-store");expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  await page.goto(`/auth/recovery?token_hash=${hash}`);await page.reload();
  await expect(page.getByRole("heading",{name:"Continuă recuperarea parolei"})).toBeVisible();
  await page.getByRole("button",{name:"Continuă",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Linkul a expirat"})).toContainText("Linkul a expirat, a fost deja folosit sau a fost înlocuit");
  await page.goto("/reset-password");await expect(page).toHaveURL(/\/login/);
});
