import { test, expect } from "@playwright/test";

test.use({ locale: "en-US" });

test("Romanian default, separate destinations, home logo and remembered cookie notice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(page.locator("#pret, #functionalitati, #platforma, #intrebari")).toHaveCount(4);
  const notice = page.locator(".cookie-notice");
  await expect(notice).toBeVisible();
  const box = await notice.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(320);
  await notice.getByRole("link").click();
  await expect(page).toHaveURL(/\/legal\/cookies$/);
  await page.getByRole("button", { name: "Am înțeles", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(notice).toHaveCount(0);
  await page.goto("/");
  for (const [name, route, section] of [
    ["Produs", "/produs", "#platforma"],
    ["Funcționalități", "/functionalitati", "#functionalitati"],
    ["Cum funcționează", "/cum-functioneaza", "#cum-functioneaza"],
    ["Preț", "/pret", "#pret"],
    ["FAQ", "/faq", "#intrebari"],
  ]) {
    await page.locator(".marketing-desktop-nav").getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.locator(section)).toBeVisible();
    await expect(page.locator(".marketing-desktop-nav").getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await page.locator("header .marketing-brand").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#hero-title")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Deschide meniul" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Preț", exact: true }).click();
  await expect(page).toHaveURL(/\/pret$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator("footer").getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page).toHaveURL(/\/#contact$/);
  await expect(page.locator("#contact-title")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("compact cookie notice fits mobile and preserves an explicit language choice", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const notice = page.locator(".cookie-notice");
  await expect(notice).toBeVisible();
  const noticeBox = (await notice.boundingBox())!;
  const languageBox = (await page.locator(".language-selector").boundingBox())!;
  expect(noticeBox.x).toBeGreaterThanOrEqual(0);
  expect(noticeBox.x + noticeBox.width).toBeLessThanOrEqual(320);
  expect(noticeBox.y + noticeBox.height).toBeLessThan(languageBox.y);
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/pret");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("cookie notice never overlaps booking or account forms on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".cookie-notice")).toBeVisible();
  await page.goto("/book/clinica-centru");
  await expect(page.locator(".cookie-notice")).toHaveCount(0);
  await page.getByRole("button", { name: /Consultație inițială/ }).click();
  await page.getByRole("button", { name: /Continuă/ }).click();
  await expect(page.getByRole("button", { name: /Primul medic disponibil/ })).toBeVisible();
  await page.goto("/login");
  await expect(page.locator(".cookie-notice")).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator(".cookie-notice")).toBeVisible();
});
