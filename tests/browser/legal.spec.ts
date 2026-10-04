import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("public legal documents disclose draft status, preserve navigation and require no tracking consent", async ({ page, context, request }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const browserOrigins = new Set<string>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => browserOrigins.add(new URL(request.url()).origin));
  await page.goto("/");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const footer = page.locator(".marketing-footer-bottom");
    await footer.scrollIntoViewIfNeeded();
    for (const link of await footer.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.goto("/register");
  await expect(page.locator(".auth-legal-note")).toContainText("Crearea contului nu semnează DPA-ul clinicii");
  await page.getByRole("link", { name: "termenii", exact: true }).click();
  await expect(page).toHaveURL(/\/legal\/terms$/);
  for (const [slug, title] of [["terms", "Termeni de utilizare"], ["privacy", "Politica de confidențialitate"], ["cookies", "Politica de cookies"], ["data-processing", "Acord de prelucrare a datelor · DPA"], ["complaints", "Reclamații și autorități"]]) {
    await page.goto(`/legal/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByLabel("Statutul documentelor")).toContainText("Firma furnizoare nu este încă înființată");
    const first = page.getByRole("navigation", { name: "Cuprins" }).getByRole("link").first();
    await first.click();
    expect(new URL(page.url()).hash).not.toBe("");
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (slug === "privacy" && width !== 320) {
        mkdirSync("test-results/legal", { recursive: true });
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `test-results/legal/privacy-${width}.png` });
      }
    }
  }
  await expect(page.getByRole("link", { name: "ANPC — portalul SAL", exact: true })).toHaveAttribute("href", "https://reclamatiisal.anpc.ro/");
  await expect(page.locator("article")).toContainText("20 iulie 2025");
  const missing = await request.get("/legal/not-a-document");
  // Next can stream before notFound resolves: validate the actual not-found UI
  // and noindex metadata rather than confusing its streamed 200 with a document.
  expect([200, 404]).toContain(missing.status());
  const missingBody = await missing.text();
  expect(missingBody).toContain("Pagina nu este disponibilă");
  expect(missingBody).toMatch(/name="robots" content="[^"]*noindex/);
  expect((await context.cookies()).filter(cookie => !cookie.name.startsWith("__next"))).toHaveLength(0);
  expect([...browserOrigins]).toEqual(["http://localhost:3100"]);
  expect(errors).toEqual([]);
});
