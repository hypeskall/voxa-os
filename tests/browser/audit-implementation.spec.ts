import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const base = "/clinics/30000000-0000-4000-8000-000000000001";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Spațiul de lucru", exact: true }),
  ).toBeVisible();
}
test("patient import previews duplicates and commits only after confirmation", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${base}/patients/import`);
  const csv =
    "name,internal_id,birth_date,phone,email\nBrowser Import,BROWSER-IMPORT-1,1990-01-01,+40700000099,import@browser.test\nBrowser Import,BROWSER-IMPORT-1,1990-01-01,+40700000099,import@browser.test\n";
  await page
    .getByLabel("Fișier", { exact: true })
    .setInputFiles({
      name: "patients.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page
    .getByRole("button", { name: "Alege coloanele" })
    .click();
  await page
    .getByRole("button", { name: "Verifică și previzualizează" })
    .click();
  await expect(page.getByText("Va fi adăugat", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Duplicat · omis", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Am verificat datele și confirm importul în această clinică.")
    .check();
  await page
    .getByRole("button", { name: "Importă pacienții verificați" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "1 pacienți adăugați, 1 duplicate omise",
  );
});
test("reception tasks save, edit and protect a dirty drawer", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${base}/tasks`);
  await page.getByRole("button", { name: "Adaugă", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titlu", { exact: true }).fill("Audit task browser");
  page.once("dialog", (d) => d.dismiss());
  await dialog.getByRole("button", { name: "Închide", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Titlu", { exact: true })).toHaveValue(
    "Audit task browser",
  );
  await dialog
    .getByLabel("Responsabil")
    .selectOption("10000000-0000-4000-8000-000000000003");
  await dialog.locator('input[name="version"]').evaluate((input:HTMLInputElement)=>{input.value="invalid-version";});
  await dialog.getByRole("button", { name: "Adaugă", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Titlu", { exact:true })).toHaveValue("Audit task browser");
  await dialog.locator('input[name="version"]').evaluate((input:HTMLInputElement)=>{input.value="";});
  await dialog.getByRole("button", { name: "Adaugă", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("Audit task browser");
  await dialog.getByRole("button", { name: "Închide", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Audit task browser" });
  await row.getByRole("button", { name: "Editează" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Stare", { exact: true })
    .selectOption("DONE");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvează modificările" })
    .click();
  await expect(page.locator("tbody")).not.toContainText("Audit task browser");
  await page.getByRole("link", { name: "Arată și istoricul" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Audit task browser" }),
  ).toContainText("Finalizat");
});
test("signed upload verifies a document and defaults to internal visibility", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${base}/patients`);
  await page.locator("tbody a.row-link").first().click();
  await page.getByRole("link", { name: "Documente", exact: true }).click();
  await page
    .getByRole("button", { name: "Încarcă document", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titlu", { exact: true }).fill("Audit signed image");
  const image = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#334455" },
  })
    .png()
    .toBuffer();
  await dialog
    .getByLabel(/^Fișier/)
    .setInputFiles({ name: "audit.png", mimeType: "image/png", buffer: image });
  await expect(
    dialog.getByLabel("Vizibil în portalul pacientului"),
  ).not.toBeChecked();
  await dialog
    .getByLabel("Am verificat pacientul, fișierul și vizibilitatea în portal.")
    .check();
  const preparedResponse = page.waitForResponse(response => response.url().endsWith("/uploads") && response.request().postDataJSON()?.phase === "prepare");
  await dialog.getByRole("button", { name: "Încarcă", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Fișierul a fost verificat și înregistrat",
  );
  const prepared = await (await preparedResponse).json();
  const integrityUrl = new URL("/test/storage-integrity", prepared.url).href;
  const inventory = await (await page.request.get(integrityUrl)).json();
  expect(inventory.objects).toContainEqual({ encrypted: true, mime: "application/octet-stream", sha256: expect.not.stringContaining(createHash("sha256").update(image).digest("hex")) });
  await dialog.getByRole("button",{name:"Închide",exact:true}).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Audit signed image" }),
  ).toContainText("Nu");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Audit signed image" }).getByRole("link", { name: "Descarcă" }).click();
  const downloaded = await downloadPromise;
  expect(downloaded.suggestedFilename()).toBe("audit.png");
  const downloadedPath = await downloaded.path();
  expect(readFileSync(downloadedPath!)).toEqual(image);
});
test("new operations pages fit mobile and render empty states", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["tasks", "waitlist", "patients/import"]) {
    await page.goto(`${base}/${path}`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/audit-${path.replaceAll("/", "-")}-mobile.png`,
      fullPage: true,
    });
  }
  await page.goto(`${base}/waitlist`);
  await page.getByRole("button", { name: "Adaugă", exact: true }).click();
  await expect(page.locator(".language-selector")).not.toBeVisible();
  await page.screenshot({
    path: "test-results/audit-waitlist-drawer-mobile.png",
    fullPage: true,
  });
});
