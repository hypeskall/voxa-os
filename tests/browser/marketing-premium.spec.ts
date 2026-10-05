import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("public product preview, pricing, ROI and FAQ have working keyboard controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Am înțeles", exact: true }).click();
  const preview = page.getByRole("tablist", {
    name: "Explorează interfața Voxa-OS",
  });
  await preview.getByRole("tab", { name: "Dashboard", exact: true }).click();
  await expect(page.locator("#hero-preview-panel img")).toHaveAttribute(
    "alt",
    /Dashboard/,
  );
  await page.keyboard.press("ArrowRight");
  await expect(
    preview.getByRole("tab", { name: "Pacient", exact: true }),
  ).toBeFocused();
  await expect(page.locator("#hero-preview-panel img")).toHaveAttribute(
    "alt",
    /Pacient/,
  );
  const expand = page.getByRole("button", { name: "Mărește previzualizarea" });
  await expand.click();
  await expect(
    page.getByRole("dialog", { name: "Pacient / Voxa-OS" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(expand).toBeFocused();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await page.locator("#pret").scrollIntoViewIfNeeded();
  await expect(page.locator(".premium-price-amount")).toContainText(
    "19,99 EUR",
  );
  await page.locator(".premium-billing-toggle label").nth(1).click();
  await expect(page.locator(".premium-price-amount")).toContainText(
    "149,99 EUR",
  );
  await page.locator(".premium-billing-toggle label").first().click();
  await expect(page.locator(".premium-price-amount")).toContainText(
    "19,99 EUR",
  );
  await expect(page.locator(".premium-price-decision a")).toHaveAttribute(
    "href",
    "/register",
  );

  await page.getByLabel("Programări pe zi", { exact: true }).fill("40");
  await page
    .getByLabel("Minute economisite / programare", { exact: true })
    .fill("3");
  await expect(page.locator(".roi-result")).toHaveAttribute(
    "aria-label",
    "44 ore pe lună, estimare",
  );
  await expect(page.locator(".roi-result strong")).toHaveText("44h");
  await expect(page.locator(".roi-note")).toContainText(
    "Nu reprezintă un rezultat garantat",
  );
  await page
    .locator("#intrebari summary")
    .filter({ hasText: "Ce se întâmplă" })
    .click();
  await expect(page.locator("#intrebari details[open]")).toContainText(
    "suspendat",
  );
  expect(errors).toEqual([]);
});

test("every public page fits desktop, laptop, tablet and small phones", async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync("test-results/marketing/premium", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Am înțeles", exact: true }).click();
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 });
    for (const route of [
      "/",
      "/produs",
      "/functionalitati",
      "/cum-functioneaza",
      "/prezentare",
      "/pret",
      "/faq",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main h1")).toHaveCount(1);
      for (const element of await page.locator("[data-reveal]").all()) {
        await element.scrollIntoViewIfNeeded();
        await expect(element).toHaveCSS("opacity", "1");
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
      const nav = (await page.locator("header .marketing-nav").boundingBox())!;
      expect(nav.x + nav.width).toBeLessThanOrEqual(width);
      await expect
        .poll(() =>
          page
            .locator("main img:visible")
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  (image as HTMLImageElement).complete &&
                  (image as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      if (route === "/" && [1440, 1024, 768, 390].includes(width)) {
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
        await expect(page.locator(".marketing-header")).not.toHaveClass(
          /is-scrolled/,
        );
        await expect(page.locator(".hero-product")).toHaveCSS("opacity", "1");
        await page.screenshot({
          path: `test-results/marketing/premium/home-${width}.png`,
          fullPage: true,
        });
        await page.screenshot({
          path: `test-results/marketing/premium/hero-${width}.png`,
        });
      }
      if (
        [1440, 390].includes(width) &&
        ["/pret", "/produs", "/functionalitati", "/prezentare"].includes(route)
      ) {
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
        await page.screenshot({
          path: `test-results/marketing/premium/${route.slice(1)}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  expect(errors).toEqual([]);
});

test("mobile menu, hover feedback, navbar and reduced motion remain accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Am înțeles", exact: true }).click();
  const cta = page.locator(".premium-hero-copy .is-primary");
  const normal = await cta.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await cta.hover();
  await expect(cta).not.toHaveCSS("background-color", normal);
  await page.locator("#functionalitati").scrollIntoViewIfNeeded();
  await expect(page.locator(".marketing-header")).toHaveClass(/is-scrolled/);
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", { name: "Deschide meniul" });
  await menu.click();
  await expect(
    page.getByRole("dialog", { name: "Voxa-OS", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .getByRole("dialog", { name: "Voxa-OS", exact: true })
    .getByRole("link", { name: "Preț", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pret$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCSS("animation-name", "none");
  for (const section of await page.locator("[data-reveal]").all()) {
    await expect(section).toHaveCSS("opacity", "1");
    await expect(section).toHaveCSS("transform", "none");
  }
  await page.getByLabel("Programări pe zi", { exact: true }).fill("30");
  await expect(page.locator(".roi-result strong")).toHaveText("55h");
});
