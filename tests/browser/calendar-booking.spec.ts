import { expect, test, type Page } from "@playwright/test";

const clinic = "30000000-0000-4000-8000-000000000001";
// Keep the scenario ahead of the test run's local clinic day so the engine does
// not correctly discard every slot after closing time.
const bookingDate = "2026-10-01";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Adresă de email").fill("owner@voxa.test");
  await page.getByLabel("Parolă", { exact: true }).fill("VoxaDev!2026");
  await page.getByRole("button", { name: "Conectare", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Spațiul de lucru" })).toBeVisible();
}

test.describe.serial("internal calendar and public booking", () => {
  test("reception flow creates an appointment and renders it in the calendar", async ({ page }) => {
    await login(page);
    await page.goto(`/clinics/${clinic}/calendar?view=week&date=2026-09-28`);
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Programare nouă" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("Caută pacient").fill("Pacient demonstrativ 01");
    await drawer.getByRole("button", { name: /Pacient demonstrativ 01/ }).click();
    await drawer.getByLabel("Serviciu").selectOption({ label: "Consultație inițială" });
    await drawer.getByLabel("Data").fill(bookingDate);
    const firstSlot = drawer.locator(".slot-picker button").first();
    await expect(firstSlot).toBeVisible();
    const internalTime = (await firstSlot.textContent())!;
    await firstSlot.click();
    await drawer.getByRole("button", { name: "Creează programarea" }).click();
    await expect(page.getByText("Programarea a fost creată", { exact: false })).toBeVisible();
    const card = page.getByRole("button", { name: /Pacient demonstrativ 01/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText(internalTime);
  });

  test("reception resizes an appointment to 45 minutes from the calendar", async ({ page }) => {
    await login(page);
    await page.goto(`/clinics/${clinic}/calendar?view=week&date=2026-09-28`);
    const card = page.getByRole("button", { name: /Pacient demonstrativ 01/ });
    await expect(card).toBeVisible();
    await card.getByRole("slider", { name: "Durata programării" }).press("ArrowDown");
    await expect(page.getByText("Durata programării a fost actualizată", { exact: false })).toBeVisible();
    await expect(card.locator(".appointment-time")).toContainText("–");
    await expect(card.getByRole("slider", { name: "Durata programării" })).toHaveAttribute("aria-valuenow", "45");
  });

  test("mobile website hides the occupied slot and creates a booking", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/book/clinica-centru");
    await expect(page.getByRole("heading", { name: "Clinic A" })).toBeVisible();
    await page.getByRole("button", { name: /Consultație inițială/ }).click();
    await page.getByRole("button", { name: /Continuă/ }).click();
    await page.getByRole("button", { name: /Primul medic disponibil/ }).click();
    await page.getByRole("button", { name: /Continuă/ }).click();
    await page.getByLabel("Data programării").fill(bookingDate);
    const slots = page.locator(".public-slot-grid button");
    await expect(slots.first()).toBeVisible();
    await expect(slots.filter({ hasText: "09:00" })).toHaveCount(0);
    await slots.first().click();
    const publicTime = (await slots.first().textContent())!;
    await page.getByRole("button", { name: /Continuă/ }).click();
    await page.getByLabel("Nume și prenume").fill("Pacient Website");
    await page.getByLabel("Email").fill("website@example.test");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Continuă/ }).click();
    await expect(page.getByText("Pacient Website", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirmă programarea" }).click();
    await expect(page.getByRole("heading", { name: /Vă așteptăm/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    test.info().annotations.push({ type: "public-time", description: publicTime });
  });

  test("website appointment appears internally and a conflicting drag rolls back", async ({ page }) => {
    await login(page);
    await page.goto(`/clinics/${clinic}/calendar?view=week&date=2026-09-28`);
    const websiteCard = page.getByRole("button", { name: /Pacient Website/ });
    const internalCard = page.getByRole("button", { name: /Pacient demonstrativ 01/ });
    await expect(websiteCard).toBeVisible();
    await expect(internalCard).toBeVisible();
    const websiteTime = (await websiteCard.locator(".appointment-time").textContent())?.split("–")[0].trim();
    const originalTime = await internalCard.locator(".appointment-time").textContent();
    await page.evaluate(({ targetTime, bookingDate }) => {
      const cards = Array.from(document.querySelectorAll<HTMLButtonElement>(".appointment-card"));
      const source = cards.find((card) => card.textContent?.includes("Pacient demonstrativ 01"));
      const target = document.querySelector<HTMLElement>(`.calendar-drop-slot[data-date="${bookingDate}"][data-time="${targetTime}"]`);
      if (!source || !target) throw new Error("Elementele pentru drag-and-drop nu au fost găsite.");
      const transfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      const bounds = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientY: bounds.top + bounds.height / 2, dataTransfer: transfer }));
      source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
    }, { targetTime: websiteTime, bookingDate });
    await expect(page.getByText("Intervalul nu mai este disponibil", { exact: false })).toBeVisible();
    await expect(internalCard.locator(".appointment-time")).toHaveText(originalTime!);
  });

  test("appointment drawer exposes workflow actions and history", async ({ page }) => {
    await login(page);
    await page.goto(`/clinics/${clinic}/calendar?view=agenda&date=2026-09-28`);
    await page.getByRole("row", { name: /Pacient Website/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Istoric", { exact: true })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Confirmă" })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Deschide pacientul" })).toBeVisible();
  });
});
