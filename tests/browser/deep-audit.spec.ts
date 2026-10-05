import { test, expect, type Page } from "@playwright/test";

const base = "/clinics/30000000-0000-4000-8000-000000000001";
async function login(page: Page, email = "owner@voxa.test") {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Spațiul de lucru", exact: true })).toBeVisible();
}

// Exercise actual list rendering with long provider payloads: document overflow
// alone cannot detect text painting over the adjacent status/action cells.
for (const width of [1440, 1024, 768, 390, 320]) {
  test(`long catalog and resource content stays inside its cells at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const long = Array.from({ length: 12 }, (_, i) => `Investigație ${i + 1} cu denumire lungă și substanță de contrast`).join(", ");
    for (const moduleKey of ["doctors", "services", "rooms", "equipment"]) {
      await page.route(`${base}/data/${moduleKey}`, route => route.fulfill({ json: {
        total: 1, items: [{
          id: "60000000-0000-4000-8000-000000000001", name: `Audit ${moduleKey} ${"denumire lungă ".repeat(6)}`,
          active: true, archived_at: null, updated_at: "2026-10-05T00:00:00Z",
          speciality_names: "Radiodiagnostic și imagistică medicală", service_names: long,
          doctor_names: long, room_names: long, equipment_names: long,
          duration_minutes: 40, category_name: "Computer tomograf", availability_count: 1,
          internal_id: "AUDIT-" + "X".repeat(45), type: "Tip de resursă cu descriere lungă ".repeat(5), capacity: 1,
        }],
      } }));
      await page.goto(moduleKey === "rooms" || moduleKey === "equipment" ? `${base}/resources?tab=${moduleKey}` : `${base}/${moduleKey}`);
      await page.getByLabel(moduleKey === "doctors" ? "Caută medic" : moduleKey === "services" ? "Caută serviciu" : "Caută în listă").fill("Audit");
      await expect(page.getByRole("link", { name: /^Audit/ }).first()).toBeVisible();
      const outside = await page.locator("tbody td").evaluateAll(cells => cells.flatMap(cell => {
        const bounds = cell.getBoundingClientRect();
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        const failures: string[] = [];
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent?.trim()) continue;
          const range = document.createRange(); range.selectNodeContents(walker.currentNode);
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width && (rect.right > bounds.right + 1 || rect.left < bounds.left - 1)) failures.push(walker.currentNode.textContent!.slice(0, 80));
          }
        }
        return failures;
      }));
      expect(outside, `${moduleKey}: text overlaps another column`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 1440) await page.screenshot({ path: `test-results/deep-audit-${moduleKey}.png`, fullPage: true });
    }
  });
}

test("patient sections respect reception permissions without replacing the whole profile with a 404", async ({ page }) => {
  await login(page, "reception@voxa.test");
  await page.goto(`${base}/patients`);
  await page.locator("tbody .row-link").first().click();
  await expect(page.getByRole("navigation", { name: "Secțiuni profil pacient" })).toBeVisible();
  const profile = page.url().split("?")[0];
  const name = await page.locator("h1").innerText();
  const nav = page.getByRole("navigation", { name: "Secțiuni profil pacient" });
  await expect(nav.getByRole("link", { name: "Rezultate", exact: true })).toBeVisible();
  await page.goto(`${profile}?tab=results`);
  await expect(nav.getByRole("link", { name: "Rezultate", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rezultate medicale", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Încarcă rezultat", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pagina nu este disponibilă" })).toHaveCount(0);
  for (const tab of ["Programări", "Documente", "Comunicări", "Istoric", "Prezentare"]) {
    const link = nav.getByRole("link", { name: tab, exact: true });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await page.goto(`${base}/results`);
  await expect(page.getByRole("heading", { name: "Rezultate medicale", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rezultat nou", exact: true })).toHaveCount(0);
});

test("owner can open every patient section and the medical results registry", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/patients`);
  await page.locator("tbody .row-link").first().click();
  await expect(page.getByRole("navigation", { name: "Secțiuni profil pacient" })).toBeVisible();
  const name = await page.locator("h1").innerText();
  for (const tab of ["Programări", "Documente", "Rezultate", "Comunicări", "Istoric", "Prezentare"]) {
    const link = page.getByRole("navigation", { name: "Secțiuni profil pacient" }).getByRole("link", { name: tab, exact: true });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pagina nu este disponibilă" })).toHaveCount(0);
  }
  await page.goto(`${base}/results`);
  await expect(page.getByRole("heading", { name: "Rezultate medicale", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rezultat nou", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("reception can read communications without seeing administrator-only template controls", async ({ page }) => {
  await login(page, "reception@voxa.test");
  await page.goto(`${base}/notifications`);
  await expect(page.getByRole("heading", { name: "Comunicări", exact: true })).toBeVisible();
  await page.locator(".template-list summary").first().click();
  await expect(page.locator(".template-list input, .template-list textarea, .template-list button")).toHaveCount(0);
  await expect(page.getByText("Șablon activ", { exact: true }).first()).toBeVisible();
});
