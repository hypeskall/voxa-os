import { test, expect, type Page } from "@playwright/test";
const clinic = "30000000-0000-4000-8000-000000000001";
async function login(page: Page, email = "owner@voxa.test") {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Spațiul de lucru" }),
  ).toBeVisible();
}
test("redirects anonymous users and presents invalid login feedback", async ({
  page,
}) => {
  await page.goto(`/clinics/${clinic}`);
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Autentificarea nu a reușit",
  );
});
test("login, preferences, clinic edit and logout", async ({
  page,
  context,
}) => {
  await login(page);
  const cookies = await context.cookies();
  expect(
    cookies
      .filter((c) => c.name.includes("auth-token"))
      .every((c) => c.httpOnly && c.sameSite === "Lax"),
  ).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${clinic}$`));
  await expect(page.getByLabel("Selectează clinica")).toHaveCount(0);
  await page.getByRole("link", { name: "Setări", exact: true }).click();
  await page.getByLabel("Densitatea tabelelor").selectOption("comfortable");
  await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Preferințe personale" }),
    })
    .getByRole("button", { name: "Salvează modificările" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Preferințele au fost salvate",
  );
  await page.reload();
  await expect(page.getByLabel("Densitatea tabelelor")).toHaveValue(
    "comfortable",
  );
  await page.getByLabel("Adresă", { exact: true }).fill("Adresă test browser");
  await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Datele clinicii" }) })
    .getByRole("button", { name: "Salvează modificările" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Datele clinicii au fost salvate",
  );
  await page.getByRole("button", { name: "Deconectare", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto(`/clinics/${clinic}`);
  await expect(page).toHaveURL(/login/);
});
test("reception cannot open team, audit or another clinic by URL", async ({
  page,
}) => {
  await login(page, "reception@voxa.test");
  await expect(
    page.getByRole("link", { name: "Echipă și acces", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Rapoarte", exact: true })).toHaveCount(0);
  for (const path of [
    `/clinics/${clinic}/team`,
    `/clinics/${clinic}/audit`,
    `/clinics/${clinic}/reports`,
    `/clinics/${clinic}/settings/organization`,
    `/clinics/${clinic}/settings/privacy`,
    "/clinics/not-a-uuid",
    "/clinics/30000000-0000-4000-8000-000000000002",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Pagina nu este disponibilă" }),
    ).toBeVisible();
  }
});
test("global search is keyboard accessible and tenant scoped",async({page})=>{
  await login(page);
  await page.keyboard.press("Control+K");
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox",{name:"Termen de căutare"}).fill("Andrei Popescu");
  await expect(dialog.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/clinics/${clinic}/(?:patients/|calendar)`));
});
test("owner can open server-side reports",async({page})=>{
  await login(page);
  await page.goto(`/clinics/${clinic}/reports`);
  await expect(page.getByRole("heading",{name:"Rapoarte",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Exportă CSV"})).toBeVisible();
});
for (const width of [1440, 1024, 768, 390, 320])
  test(`responsive shell at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/workspace-${width}.png`,
      fullPage: true,
    });
    if (width < 760) {
      await page.getByRole("button", { name: "Deschide meniul" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else {
      await page.getByRole("button", { name: "Restrânge meniul" }).click();
      await expect(
        page.getByRole("button", { name: "Extinde meniul" }),
      ).toBeVisible();
    }
    await page.goto(`/clinics/${clinic}/team`);
    await expect(
      page.getByRole("heading", { name: "Echipă și acces" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto(`/clinics/${clinic}/settings`);
    await expect(
      page.getByRole("heading", { name: "Setări", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
test("dialog supports keyboard dismissal and restores focus", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/clinics/${clinic}/patients`);
  await page.getByRole("button", { name: "Adaugă pacient" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Adaugă pacient" }),
  ).toBeFocused();
});
test("mobile navigation closes the drawer after selecting a page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "Deschide meniul" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Setări", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Setări", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("login fits a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Conectare", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/login-320.png", fullPage: true });
});
