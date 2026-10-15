import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

async function scrub(page: Page, ratio: number, chapter: number) {
  await page.locator("#platforma").evaluate((element, value) => {
    const top = element.getBoundingClientRect().top + scrollY;
    scrollTo({
      top: top + (element.getBoundingClientRect().height - innerHeight) * value,
      behavior: "instant",
    });
  }, ratio);
  await expect(page.locator("#platforma")).toHaveAttribute(
    "data-cinema-chapter",
    String(chapter),
  );
  await expect(page.locator(".cinema-chapter-copy > div").nth(1)).toHaveCSS(
    "opacity",
    "1",
  );
}

test.beforeEach(async ({ context, baseURL }) => {
  mkdirSync("artifacts/landing-cinema", { recursive: true });
  await context.addCookies([
    { name: "voxa-cookie-notice", value: "dismissed", url: baseURL! },
  ]);
});

test("scroll directs four crisp product scenes, 3D motion and a moving appointment without demo controls", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "artifacts/landing-cinema/hero-desktop.png" });
  await expect(
    page.locator(
      "#platforma button, #platforma input, #platforma select, #platforma form, #platforma img, #platforma canvas",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".cinema-sticky-stage")).toHaveCSS(
    "position",
    "sticky",
  );
  await expect(page.locator(".cinema-camera")).toHaveCSS(
    "perspective",
    "1700px",
  );
  await scrub(page, 0.16, 0);
  const rig = page.locator(".cinema-rig");
  const start = await rig.evaluate((el) => getComputedStyle(el).transform);
  await page.screenshot({
    path: "artifacts/landing-cinema/dashboard-desktop.png",
  });
  await scrub(page, 0.39, 1);
  const event = page.locator(".cinema-front-layer .is-moving");
  await expect(event).toBeVisible();
  expect(
    await page
      .locator(".cinema-front-layer .cinema-calendar-event > strong")
      .evaluateAll((elements) =>
        elements.every(
          (element) => element.clientHeight >= element.scrollHeight,
        ),
      ),
  ).toBe(true);
  const before = await event.evaluate((el) =>
    parseFloat(getComputedStyle(el).getPropertyValue("--move")),
  );
  await scrub(page, 0.53, 1);
  await expect
    .poll(() =>
      event.evaluate((el) =>
        parseFloat(getComputedStyle(el).getPropertyValue("--move")),
      ),
    )
    .toBeGreaterThan(before + 0.5);
  await expect
    .poll(() => rig.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(start);
  await page.screenshot({
    path: "artifacts/landing-cinema/calendar-desktop.png",
  });
  await scrub(page, 0.75, 2);
  await expect(
    page.locator(".cinema-front-layer .cinema-patient-hero"),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/landing-cinema/patient-desktop.png",
  });
  await scrub(page, 0.99, 3);
  await expect(page.locator(".cinema-back-layer").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({
    path: "artifacts/landing-cinema/layers-desktop.png",
  });
  const card = page.locator(".premium-module-grid article").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-visible", "true");
  await expect(card).toHaveCSS("opacity", "1");
  await page.locator("#pret").scrollIntoViewIfNeeded();
  await expect(page.locator(".premium-price-panel")).toHaveCSS("opacity", "1");
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await expect(page.locator(".contact-details")).toHaveCSS("opacity", "1");
  await expect(
    page.locator(".contact-details a[href^='tel:']"),
  ).toHaveAttribute("href", "tel:+40770541817");
  await expect(
    page.locator(".contact-details a[href^='mailto:']"),
  ).toHaveAttribute("href", "mailto:contact@voxatech.ro");
  await page
    .locator(".contact-layout")
    .screenshot({ path: "artifacts/landing-cinema/contact-desktop.png" });
  expect(errors).toEqual([]);
});

test("cinema fits phones, tablets and desktop and follows mobile scrolling", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  for (const width of [320, 390, 768, 1101, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const selector of [
      "#platforma",
      "#functionalitati",
      "#cum-functioneaza",
      "#pret",
    ]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${selector} at ${width}px`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "artifacts/landing-cinema/hero-mobile.png" });
  for (const [ratio, chapter] of [
    [0.16, 0],
    [0.48, 1],
    [0.75, 2],
    [0.99, 3],
  ]) {
    await scrub(page, ratio, chapter);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/landing-cinema/chapter-${chapter}-mobile.png`,
    });
  }
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await expect(page.locator(".contact-details")).toHaveCSS("opacity", "1");
  await page
    .locator(".contact-layout")
    .screenshot({ path: "artifacts/landing-cinema/contact-mobile.png" });
});

test("the full landing motion stays enabled regardless of browser motion preference", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCSS(
    "animation-name",
    "cinema-hero-enter",
  );
  await scrub(page, 0.48, 1);
  await expect(page.locator(".cinema-front-layer .is-moving")).toBeVisible();
  await expect(page.locator(".luxury-scroll-progress")).toBeVisible();
});
