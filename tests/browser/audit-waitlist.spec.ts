import { test, expect } from "@playwright/test";
const base = "/clinics/30000000-0000-4000-8000-000000000001";
test("waiting list proposes an available slot and creates a real internal booking after acceptance", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Spațiul de lucru", exact: true }),
  ).toBeVisible();
  await page.goto(`${base}/waitlist`);
  await page.getByRole("button", { name: "Adaugă", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titlu", { exact: true }).fill("Audit waiting list");
  await dialog
    .getByRole("group", { name: "Pacient", exact: true })
    .getByRole("radio")
    .first()
    .check();
  await dialog
    .getByRole("group", { name: "Serviciu", exact: true })
    .getByRole("radio", { name: "Consultație inițială", exact: true })
    .check();
  await dialog
    .getByLabel("Disponibil de la", { exact: true })
    .fill("2027-02-01T08:00");
  await dialog
    .getByLabel("Disponibil până la", { exact: true })
    .fill("2027-02-01T18:00");
  await dialog.getByRole("button", { name: "Adaugă", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("salvate");
  await dialog.getByRole("button", { name: "Închide", exact: true }).click();
  let row = page.getByRole("row").filter({ hasText: "Audit waiting list" });
  await row
    .getByRole("button", { name: "Propune interval", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Caută intervale disponibile", exact: true })
    .click();
  await expect(dialog.getByLabel("Interval", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Propune intervalul", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Interval propus");
  await dialog.getByRole("button", { name: "Închide", exact: true }).click();
  row = page.getByRole("row").filter({ hasText: "Audit waiting list" });
  await row.getByLabel("Pacientul a acceptat intervalul").check();
  await row
    .getByRole("button", { name: "Creează programarea", exact: true })
    .click();
  await expect(page.locator("tbody")).not.toContainText("Audit waiting list");
  await page
    .getByRole("link", { name: "Arată și istoricul", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Audit waiting list" }),
  ).toContainText("Programat");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Audit waiting list" })
      .getByRole("link", { name: "Vezi programarea" }),
  ).toBeVisible();
});
