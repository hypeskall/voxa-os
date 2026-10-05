import { test, expect, type Page } from "@playwright/test";

async function selectLanguage(page: Page, locale: string) {
  await page.getByRole("combobox", { name: "Language", exact: true }).click();
  await page.locator(`[role="option"][id$="-${locale}"]`).click();
}

test("website languages persist and platform language changes retain the session and patient data", async ({ page }) => {
  await page.goto("/pret");
  for (const [locale, label] of [["en", "Sign in"], ["de", "Anmelden"], ["fr", "Connexion"], ["es", "Iniciar sesión"], ["it", "Accedi"], ["pl", "Zaloguj się"], ["ro", "Autentificare"]]) {
    await selectLanguage(page, locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("banner").getByRole("link", { name: label, exact: true })).toBeVisible();
    await expect(page.locator(".premium-price-amount")).toContainText("19,99 EUR");
    await page.locator(".premium-billing-toggle label").nth(1).click();
    await expect(page.locator(".premium-price-amount")).toContainText("149,99 EUR");
    await page.locator(".premium-billing-toggle label").first().click();
  }
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page).toHaveURL(/\/clinics\/[^/]+$/);
  await page.getByRole("link", { name: "Pacienți", exact: true }).click();
  await expect(page).toHaveURL(/\/patients$/);
  const original = await page.locator("tbody tr td").first().innerText();
  await selectLanguage(page, "en");
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole("link", { name: "Patients", exact: true })).toBeVisible();
  await expect(page.locator("tbody tr td").first()).toHaveText(original);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/\/patients$/);
});

test("language menu supports keyboard navigation, dismissal and mobile selection", async ({ page }) => {
  await page.goto("/login");
  const selector = page.getByRole("combobox", { name: "Language", exact: true });
  const options = page.getByRole("listbox", { name: "Language", exact: true });
  await selector.focus();
  await page.keyboard.press("ArrowDown");
  await expect(selector).toHaveAttribute("aria-expanded", "true");
  await expect(options.getByRole("option", { name: "Română", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(selector).toHaveAttribute("aria-activedescendant", /-en$/);
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await selector.click();
  await page.keyboard.press("End");
  await expect(selector).toHaveAttribute("aria-activedescendant", /-pl$/);
  await page.keyboard.press("Home");
  await expect(selector).toHaveAttribute("aria-activedescendant", /-ro$/);
  await page.keyboard.press("Escape");
  await expect(options).not.toBeVisible();
  await expect(selector).toBeFocused();
  await selector.click();
  await page.keyboard.press("f");
  await expect(selector).toHaveAttribute("aria-activedescendant", /-fr$/);
  await page.keyboard.press("Tab");
  await expect(selector).toHaveAttribute("aria-expanded", "false");
  await selector.click();
  await page.getByRole("heading").first().click();
  await expect(selector).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize({ width: 390, height: 844 });
  await selector.click();
  const box = await options.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await options.getByRole("option", { name: "Română", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await selector.click();
  await expect(page.locator(".language-selector-menu")).toHaveCSS("transition-duration", "0s");
  await options.getByRole("option", { name: "Deutsch", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});
