import { test, expect, type Page } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  // /dashboard is an intermediate redirect, so wait for the rendered workspace.
  await expect(page.getByRole("heading", { name: "Spațiul de lucru", exact: true })).toBeVisible({ timeout: 15000 });
}

test("expired activity cannot access pages, APIs or restart through a heartbeat", async ({ page, request }) => {
  test.setTimeout(60000);
  await login(page);
  // Stop the live activity guard before ageing the session. Otherwise it can
  // sign out in the background before the direct protected-page check below.
  await page.goto("/");
  const aged = await request.post("http://127.0.0.1:54329/test/session-age", { data: { idleSeconds: 601 } });
  expect(aged.ok()).toBe(true);
  const status = await page.context().request.get("http://localhost:3100/api/clinics/30000000-0000-4000-8000-000000000001/patients/10000000-0000-4000-8000-000000000001/export");
  expect(status.status()).toBe(401);
  const heartbeat = await page.context().request.post("http://localhost:3100/api/session/activity", { headers: { Origin: "http://localhost:3100" }, data: { activity: true } });
  expect(heartbeat.status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.getByText("Sesiunea a expirat. Conectați-vă din nou pentru a continua.")).toBeVisible();
});

for (const responseDelay of [0, 6000]) {
  const suffix = responseDelay ? " with a slow confirmation response" : "";
  test(`security changes require the current user's password again after five minutes${suffix}`, async ({ page, request }) => {
    test.setTimeout(60000);
    await login(page);
    const aged = await request.post("http://127.0.0.1:54329/test/session-age", { data: { startedSeconds: 361 } });
    expect(aged.ok()).toBe(true);
    await page.goto("/account/security");
    let delayed = false;
    if (responseDelay) {
      await page.route("**/account/security", async route => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        if (response.headers()["x-action-redirect"]?.includes("/auth/reauthenticate")) {
          delayed = true;
          await delay(responseDelay);
        }
        await route.fulfill({ response });
      });
    }
    await page.getByLabel("Confirm deconectarea celorlalte dispozitive.").check();
    await page.getByRole("button", { name: "Deconectează celelalte dispozitive" }).click();
    // The dev server may compile this route on its first server-action redirect.
    // Wait for navigation before applying the normal five-second UI assertion.
    await expect(page).toHaveURL(
      url => url.pathname === "/auth/reauthenticate" && url.searchParams.get("next") === "/account/security",
      { timeout: 15000 },
    );
    await expect(page.getByRole("heading", { name: "Confirmă accesul" })).toBeVisible();
    if (responseDelay) expect(delayed).toBe(true);
    await page.getByLabel("Parolă", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Confirmă parola" }).click();
    await expect(page.getByText("Parola nu a putut fi confirmată. Reîncercați.")).toBeVisible();
    await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
    await page.getByRole("button", { name: "Confirmă parola" }).click();
    await expect(page).toHaveURL(/\/account\/security$/);
  });
}
