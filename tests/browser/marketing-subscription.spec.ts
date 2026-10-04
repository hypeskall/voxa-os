import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
const clinic = "30000000-0000-4000-8000-000000000001";
const organization = "20000000-0000-4000-8000-000000000001";
async function login(page: Page, email = "owner@voxa.test") {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
}
test("public homepage, pricing, functional walkthrough and mobile layout", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(page.locator(".hero-screen-frame img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".hero-screen-frame img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("heading", { name: "Mai mult control. Mai puțin haos." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: "Începe testarea gratuită", exact: true })
      .first(),
  ).toHaveAttribute("href", "/register");
  await expect(page.locator("#pret")).toContainText("19,99 EUR");
  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await expect(page.locator("#product-panel").getByRole("img")).toHaveAttribute(
    "alt",
    /Calendar/,
  );
  await page.getByRole("button", { name: "Pornește turul" }).click();
  await expect(
    page.getByRole("button", { name: "Oprește turul" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Oprește turul" }).click();
  await page
    .locator("#intrebari summary")
    .filter({ hasText: "Ce se întâmplă" })
    .click();
  await expect(page.locator("#intrebari details[open]")).toContainText(
    "suspendat",
  );
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  mkdirSync("test-results/marketing", { recursive: true });
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/");
    await expect(page.locator(".hero-product")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `test-results/marketing/hero-${width}.png` });
    for (const section of await page.locator("[data-reveal]").all()) {
      await section.scrollIntoViewIfNeeded();
      await expect(section).toHaveCSS("opacity", "1");
    }
    if (width === 390 || width === 1440) {
      await page
        .locator("#functionalitati")
        .screenshot({ path: `test-results/marketing/features-${width}.png` });
      await page
        .locator(".product-story")
        .nth(1)
        .screenshot({
          path: `test-results/marketing/calendar-story-${width}.png`,
        });
      await page
        .locator("#prezentare")
        .screenshot({
          path: `test-results/marketing/walkthrough-${width}.png`,
        });
    }
    await page.locator("#pret").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/marketing/pricing-${width}.png`,
    });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      (document.activeElement as HTMLElement)?.blur();
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({
      path: `test-results/marketing/${width === 390 ? "mobile" : width === 1440 ? "desktop" : `page-${width}`}.png`,
      fullPage: true,
    });
  }
});

test("mobile navigation, keyboard product controls, dialogs and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Deschide meniul" });
  await menuButton.click();
  const menu = page.getByRole("dialog", { name: "Voxa-OS" });
  await expect(menu).toBeVisible();
  await page.screenshot({ path: "test-results/marketing/mobile-menu.png" });
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await menu.getByRole("link", { name: "Preț", exact: true }).click();
  await expect(menu).not.toBeVisible();
  await expect(page).toHaveURL(/#pret$/);
  await expect(page.locator(".marketing-header")).toHaveClass(/is-scrolled/);
  await page.getByRole("tab", { name: "Medici", exact: true }).click();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("tab", { name: "Servicii", exact: true }).first(),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#workspace-panel img")).toHaveAttribute(
    "alt",
    /Servicii/,
  );
  await page.getByRole("link", { name: "Confidențialitate", exact: true }).click();
  await expect(page).toHaveURL(/\/legal\/privacy$/);
  await expect(page.getByRole("heading", { name: "Politica de confidențialitate", exact: true })).toBeVisible();
  await expect(page.getByLabel("Statutul documentelor")).toContainText("Proiect pentru revizuire");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".hero-screen-frame")).toHaveCSS(
    "transform",
    "none",
  );
  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await expect(page.locator(".walkthrough-frame")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator("#product-panel img")).toHaveAttribute(
    "alt",
    /Calendar/,
  );
});

test("walkthrough advances, pauses, completes and replays", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page
    .getByRole("tab", { name: "Privire de ansamblu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pornește turul", exact: true })
    .click();
  await expect(page.locator(".product-showcase")).toHaveAttribute(
    "data-playing",
    "true",
  );
  await page.clock.runFor(4200);
  await expect(page.locator("#product-panel img")).toHaveAttribute(
    "alt",
    /Calendar/,
  );
  await page
    .getByRole("button", { name: "Oprește turul", exact: true })
    .click();
  await page.clock.runFor(8000);
  await expect(page.locator("#product-panel img")).toHaveAttribute(
    "alt",
    /Calendar/,
  );
  await page
    .getByRole("button", { name: "Pornește turul", exact: true })
    .click();
  for (const caption of [
    /Programare/,
    /Pacient/,
    /Servicii/,
    /Spațiul de lucru/,
  ]) {
    await page.clock.runFor(4200);
    await expect(page.locator("#product-panel img")).toHaveAttribute(
      "alt",
      caption,
    );
  }
  await page.clock.runFor(4200);
  await expect(page.getByRole("button", { name: "Reia turul" })).toBeVisible();
  await page.getByRole("button", { name: "Reia turul" }).click();
  await expect(page.locator("#product-panel img")).toHaveAttribute(
    "alt",
    /Privire de ansamblu/,
  );
  await expect(
    page.getByRole("button", { name: "Oprește turul", exact: true }),
  ).toBeVisible();
});
test("captures actual app product views with fixture data", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await request.post("http://127.0.0.1:54329/test/subscription", {
    data: { expired: false },
  });
  const demo = await request.post("http://127.0.0.1:54329/test/product-demo");
  const demoData = await demo.json();
  expect(demoData).toMatchObject({ ok: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Spațiul de lucru", exact: true }),
  ).toBeVisible();
  const screenshotDirectory =
    process.env.VOXA_CAPTURE_MARKETING === "1"
      ? "public/marketing"
      : "test-results/marketing/product";
  mkdirSync(screenshotDirectory, { recursive: true });
  const views = [
    { suffix: "", name: "dashboard", heading: "Spațiul de lucru" },
    {
      suffix: `/calendar?view=week&date=${demoData.date}`,
      name: "calendar",
      heading: "Calendar",
    },
    { suffix: "/patients", name: "patients", heading: "Pacienți" },
    { suffix: "/doctors", name: "doctors", heading: "Medici" },
    {
      suffix: "/services",
      name: "services",
      heading: "Servicii și investigații",
    },
    { suffix: "/team", name: "team", heading: "Echipă și acces" },
  ];
  for (const view of views) {
    await page.goto(`/clinics/${clinic}${view.suffix}`);
    await expect(
      page.getByRole("heading", { name: view.heading, exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${screenshotDirectory}/${view.name}.png` });
  }
  await page.goto(`/clinics/${clinic}/patients`);
  await page
    .locator(`table a[href^="/clinics/${clinic}/patients/"]`)
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: "Prezentare", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${screenshotDirectory}/patient-profile.png` });
  await page.goto(
    `/clinics/${clinic}/calendar?view=week&date=${demoData.date}`,
  );
  await page.locator(".appointment-card").first().click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Deschide pacientul" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Se verifică disponibilitatea..."),
  ).not.toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/appointment.png` });
  await page
    .getByRole("dialog")
    .screenshot({ path: `${screenshotDirectory}/appointment-detail.png` });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }).first(),
  ).toHaveAttribute("href", "/dashboard");
});
test("owner billing, expiry lockout, license activation, protected API and non-owner denial", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const reset = await request.post("http://127.0.0.1:54329/test/subscription", {
    data: { expired: true },
  });
  const { code } = await reset.json();
  try {
    await login(page);
    await expect(page).toHaveURL(
      new RegExp(`/organizations/${organization}/subscription-expired`),
    );
    await expect(
      page.getByRole("heading", { name: "Continuăm când ești pregătit." }),
    ).toBeVisible();
    await page.goto(`/clinics/${clinic}/patients`);
    await expect(page).toHaveURL(/subscription-expired/);
    const api = await page.request.post(`/api/clinics/${clinic}/search`, {
      data: { query: "Andrei" },
      maxRedirects: 0,
    });
    expect(api.status()).toBe(307);
    expect(api.headers().location).toContain("subscription-expired");
    await page.getByRole("link", { name: "Introdu codul de licență" }).click();
    await expect(
      page.getByRole("heading", { name: "Un plan. Toată clinica." }),
    ).toBeVisible();
    await expect(page.locator(".billing-status")).toHaveText("Expirat");
    await page
      .getByLabel("Cod de licență")
      .fill("VOXA-0000-0000-0000-0000-0000-0000-0000-0000");
    await page.getByRole("button", { name: "Activează licența" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "nu poate fi activată",
    );
    await page.getByLabel("Cod de licență").fill(code);
    await page.getByRole("button", { name: "Activează licența" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Licența a fost activată",
    );
    await expect(page.locator(".billing-status")).toHaveText("Activ");
    await page.getByRole("link", { name: "Înapoi în platformă" }).click();
    await expect(
      page.getByRole("heading", { name: "Spațiul de lucru", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Deconectare", exact: true })
      .click();
    await expect(page).toHaveURL(/login/);
    await login(page, "reception@voxa.test");
    await expect(
      page.getByRole("heading", { name: "Spațiul de lucru", exact: true }),
    ).toBeVisible();
    await page.goto(`/organizations/${organization}/billing`);
    await expect(
      page.getByRole("heading", { name: "Pagina nu este disponibilă" }),
    ).toBeVisible();
  } finally {
    await request.post("http://127.0.0.1:54329/test/subscription", {
      data: { expired: false },
    });
  }
});
