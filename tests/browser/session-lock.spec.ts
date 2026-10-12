import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test("expired activity cannot access pages, APIs or restart through a heartbeat", async ({ page, request }) => {
  await login(page);
  await request.post("http://127.0.0.1:54329/test/session-age", { data: { idleSeconds: 601 } });
  const status = await page.context().request.get("http://localhost:3100/api/clinics/30000000-0000-4000-8000-000000000001/patients/10000000-0000-4000-8000-000000000001/export");
  expect(status.status()).toBe(401);
  const heartbeat = await page.context().request.post("http://localhost:3100/api/session/activity", { headers: { Origin: "http://localhost:3100" }, data: { activity: true } });
  expect(heartbeat.status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.getByText("Sesiunea a expirat. Conectați-vă din nou pentru a continua.")).toBeVisible();
});
test("security changes require the current user's password again after five minutes", async ({ page, request }) => {
  await login(page);
  await request.post("http://127.0.0.1:54329/test/session-age", { data: { startedSeconds: 361 } });
  await page.goto("/account/security");
  await page.getByLabel("Confirm deconectarea celorlalte dispozitive.").check();
  await page.getByRole("button", { name: "Deconectează celelalte dispozitive" }).click();
  await expect(page.getByRole("heading", { name: "Confirmă accesul" })).toBeVisible();
  await page.getByLabel("Parolă", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Confirmă parola" }).click();
  await expect(page.getByText("Parola nu a putut fi confirmată. Reîncercați.")).toBeVisible();
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Confirmă parola" }).click();
  await expect(page).toHaveURL(/\/account\/security$/);
});
