import { test, expect, type Page } from "@playwright/test";
const clinic = "30000000-0000-4000-8000-000000000001";
const base = `/clinics/${clinic}`;
async function login(page: Page, email = "owner@voxa.test") {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Spațiul de lucru" }),
  ).toBeVisible();
}
const cases = [
  {
    mod: "patients",
    singular: "pacient",
    nameLabel: "Nume și prenume",
    fields: {
      "Identificator intern": "BROWSER-PAT",
      Telefon: "0712345678",
      Email: "patient@browser.test",
      Adresă: "Adresă fictivă",
      "Note administrative": "Notă administrativă de test",
    },
  },
  {
    mod: "doctors",
    singular: "medic",
    nameLabel: "Nume și prenume",
    fields: { "Identificator intern": "BROWSER-DOC" },
  },
  {
    mod: "specialities",
    singular: "specialitate",
    nameLabel: "Nume",
    fields: { Descriere: "Specialitate configurabilă" },
  },
  {
    mod: "categories",
    singular: "categorie",
    nameLabel: "Nume",
    fields: { Descriere: "Categorie configurabilă" },
  },
  {
    mod: "services",
    singular: "serviciu",
    nameLabel: "Nume",
    fields: {
      "Preț (RON)": "125.50",
      "Instrucțiuni de pregătire": "Instrucțiuni configurabile",
      "Documente necesare": "Document A\nDocument B",
      "Avertismente / reguli de excludere": "Evaluare necesară",
    },
  },
  {
    mod: "rooms",
    singular: "cabinet",
    nameLabel: "Nume",
    fields: { Tip: "Consultații", Capacitate: "2" },
  },
  {
    mod: "equipment",
    singular: "echipament",
    nameLabel: "Nume",
    fields: { "Identificator intern": "BROWSER-EQ", Tip: "Diagnostic" },
  },
];
for (const entry of cases)
  test(`real database CRUD: ${entry.mod}`, async ({ page }) => {
    await login(page);
    await page.goto(`${base}/${entry.mod}`);
    await page
      .getByRole("button", { name: `Adaugă ${entry.singular}`, exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    const name = `Browser ${entry.mod}`;
    await dialog.getByLabel(entry.nameLabel, { exact: true }).fill(name);
    for (const [label, value] of Object.entries(entry.fields))
      await dialog.getByLabel(label, { exact: true }).fill(value!);
    await dialog.getByRole("button", { name: "Creează înregistrarea" }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const profile = page.url();
    await page.reload();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    if (entry.mod === "patients") {
      for (const [tab, emptyState] of [
        ["Programări", "Nu există programări."],
        ["Documente", "Nu există documente încărcate."],
        ["Rezultate", "Nu există rezultate."],
        ["Comunicări", "Nu există comunicări înregistrate manual."],
      ]) {
        await page.getByRole("navigation", { name: "Secțiuni profil pacient" }).getByRole("link", { name: tab, exact: true }).click();
        await expect(page.getByText(emptyState, { exact: false })).toBeVisible();
      }
      await page.getByRole("link", { name: "Istoric", exact: true }).click();
      await expect(
        page.getByRole("cell", { name: "Creare", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Overview", exact: true }).click();
    }
    await page.getByRole("button", { name: "Editează", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(entry.nameLabel, { exact: true })
      .fill(name + " actualizat");
    await dialog.getByRole("button", { name: "Salvează modificările" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: name + " actualizat", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Arhivează", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmă arhivarea" })
      .click();
    await expect(page).toHaveURL(`${base}/${entry.mod}`);
    const isCatalog = entry.mod === "doctors" || entry.mod === "services";
    await page.getByLabel(isCatalog ? "Status" : "Filtrează după stare").selectOption("archived");
    await page.getByLabel(isCatalog ? entry.mod === "doctors" ? "Caută medic" : "Caută serviciu" : "Caută în listă").fill(name);
    await expect(
      page.getByRole("link", { name: name + " actualizat", exact: true }),
    ).toBeVisible();
    await page.goto(profile);
    await page
      .getByRole("button", { name: "Restaurează", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmă restaurarea" })
      .click();
    await expect(
      page.getByRole("button", { name: "Editează", exact: true }),
    ).toBeVisible();
  });
test("resource tabs load the correct registry", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/resources?tab=rooms`);
  await expect(
    page.getByRole("link", { name: "Browser rooms actualizat", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Echipamente", exact: true }).click();
  await expect(page).toHaveURL(`${base}/resources?tab=equipment`);
  await expect(
    page.getByRole("link", {
      name: "Browser equipment actualizat",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browser rooms actualizat", exact: true }),
  ).toHaveCount(0);
});
test("relations and consolidated doctor availability", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${base}/doctors`);
  await page
    .getByRole("link", { name: "Browser doctors actualizat", exact: true })
    .click();
  await page.getByRole("button", { name: "Editează", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("checkbox", {
      name: "Browser specialities actualizat",
      exact: true,
    })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Browser services actualizat", exact: true })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Browser rooms actualizat", exact: true })
    .check();
  await dialog.getByRole("button", { name: "Salvează modificările" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Secțiuni configurare" }).getByRole("link", { name: "Servicii", exact: true }).click();
  await expect(
    page.locator("dd").filter({ hasText: "Browser services actualizat" }),
  ).toBeVisible();
  await page.getByRole("navigation", { name: "Secțiuni configurare" }).getByRole("link", { name: "Program", exact: true }).click();
  await page.getByRole("button", { name: "Adaugă interval" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Se aplică pentru"),
  ).toHaveValue("doctor");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("radio", { name: "Browser doctors actualizat" }),
  ).toBeChecked();
  await page
    .getByRole("dialog")
    .getByLabel("Denumire interval")
    .fill("Program medic browser");
  await page.getByRole("dialog").getByLabel("Ora de început").fill("09:00");
  await page.getByRole("dialog").getByLabel("Ora de sfârșit").fill("13:00");
  await page.getByRole("dialog").getByLabel("Valabil din").fill("2026-01-01");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Creează înregistrarea" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Program medic browser" }),
  ).toBeVisible();
});
test("consolidated availability manages clinic hours and unavailability", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/availability`);
  await expect(page.getByRole("heading", { name: "Disponibilitate" })).toBeVisible();
  await page.getByRole("button", { name: "Modifică programul" }).click();
  const schedule = page.getByRole("dialog");
  await schedule.getByLabel("Luni început").fill("08:00");
  await schedule.getByLabel("Luni sfârșit").fill("20:00");
  await schedule.getByRole("button", { name: "Salvează programul" }).click();
  await expect(schedule.getByRole("status")).toContainText("Programul clinicii a fost actualizat.");
  await schedule.getByRole("button", { name: "Închide" }).click();
  await page.getByRole("link", { name: "Indisponibilități", exact: true }).click();
  await page.getByRole("button", { name: "Adaugă indisponibilitate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nume", { exact: true }).fill("Blocare browser");
  await dialog.getByLabel("Început", { exact: true }).fill("2026-12-25T09:00");
  await dialog.getByLabel("Sfârșit", { exact: true }).fill("2026-12-25T12:00");
  await dialog.getByRole("button", { name: "Creează înregistrarea" }).click();
  await expect(page.getByRole("heading", { name: "Blocare browser" })).toBeVisible();
});
test("reception has patient CRUD but cannot edit catalog or access Clinic B", async ({
  page,
}) => {
  await login(page, "reception@voxa.test");
  await page.goto(`${base}/patients`);
  await expect(
    page.getByRole("button", { name: "Adaugă pacient" }),
  ).toBeVisible();
  await page.goto(`${base}/services`);
  await expect(
    page.getByRole("button", { name: "Adaugă serviciu" }),
  ).toHaveCount(0);
  await page.goto("/clinics/30000000-0000-4000-8000-000000000002/patients");
  await expect(
    page.getByRole("heading", { name: "Pagina nu este disponibilă" }),
  ).toBeVisible();
});
for (const width of [1440, 768, 390, 320])
  test(`core registry and drawer responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto(`${base}/patients`);
    await expect(
      page.getByRole("heading", { name: "Pacienți", exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > innerWidth)
        .map(
          (el) =>
            `${el.tagName}.${el.className}: width=${el.getBoundingClientRect().width} right=${el.getBoundingClientRect().right} overflow=${getComputedStyle(el).overflow}`,
        ),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      overflow.join("\n"),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/patients-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Adaugă pacient" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/patient-editor-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

