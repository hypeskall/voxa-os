import { test, expect } from "@playwright/test";

test("website languages persist and platform language changes retain the session and patient data", async ({ page }) => {
  await page.goto("/pret");
  for (const [locale, label] of [["en", "Sign in"], ["de", "Anmelden"], ["fr", "Connexion"], ["es", "Iniciar sesión"], ["it", "Accedi"], ["pl", "Zaloguj się"], ["ro", "Autentificare"]]) {
    await page.getByRole("combobox", { name: "Language", exact: true }).selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("banner").getByRole("link", { name: label, exact: true })).toBeVisible();
    await expect(page.locator(".plan-picker")).toContainText("149,99 EUR");
  }
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page).toHaveURL(/\/clinics\/[^/]+$/);
  await page.getByRole("link", { name: "Pacienți", exact: true }).click();
  await expect(page).toHaveURL(/\/patients$/);
  const original = await page.locator("tbody tr td").first().innerText();
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("en");
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole("link", { name: "Patients", exact: true })).toBeVisible();
  await expect(page.locator("tbody tr td").first()).toHaveText(original);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/\/patients$/);
});
