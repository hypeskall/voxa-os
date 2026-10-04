import { test, expect } from "@playwright/test";

test("public account entry and switching an existing session never trap the user in a dashboard", async ({page}) => {
  await page.goto("/");
  await page.getByRole("link",{name:"Autentificare",exact:true}).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading",{name:"Conectare",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Creează un cont",exact:true}).click();
  await expect(page.getByLabel("Nume complet")).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă",{exact:true}).fill("VoxaDev!2026");
  await page.getByRole("button",{name:"Conectare",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Spațiul de lucru"})).toBeVisible();
  await page.goto("/");
  await page.getByRole("link",{name:"Schimbă contul",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Ai deja o sesiune conectată");
  await page.getByRole("button",{name:"Deconectează-te și schimbă contul"}).click();
  await expect(page.getByLabel("Utilizator")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("new account entry clears an existing session by POST and preserves invitation context", async ({page}) => {
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă",{exact:true}).fill("VoxaDev!2026");
  await page.getByRole("button",{name:"Conectare",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Spațiul de lucru"})).toBeVisible();
  const next="/invitations/"+"a".repeat(43);
  await page.goto("/register?next="+encodeURIComponent(next));
  await expect(page.getByLabel("Nume complet")).toHaveCount(0);
  await page.getByRole("button",{name:"Deconectează-te și creează un cont"}).click();
  await expect(page.getByLabel("Nume complet")).toBeVisible();
  await expect(page.locator('input[name="next"]')).toHaveValue(next);
});
