import { test,expect,type Page } from "@playwright/test";
const password="VoxaSecure!2026";
test("login cannot submit credentials before hydration or without JavaScript",async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 try{const page=await context.newPage();await page.goto("http://localhost:3100/login");
 await expect(page.locator("form")).toHaveAttribute("method","post");
 // Next's streamed form can remain hidden without its reveal script. Inspect
 // the actual server-rendered controls, including that hidden boundary.
 await expect(page.getByLabel("Utilizator")).toBeDisabled();await expect(page.getByLabel("Parolă",{exact:true})).toBeDisabled();await expect(page.locator("form button")).toHaveCount(1);await expect(page.locator("form button")).toBeDisabled();
 }finally{await context.close();}
});
async function signIn(page:Page,email:string){await page.goto("/login");await page.getByLabel("Utilizator").fill(email);await page.getByLabel("Parolă",{exact:true}).fill(password);await page.getByRole("button",{name:"Conectare",exact:true}).click();}
test("new clinic: registration, resumable setup, patient, appointment and session persistence",async({page})=>{
 test.setTimeout(120000);
 const email=`owner-${Date.now()}@clinica-test.ro`;
 const browserErrors:string[]=[];page.on("pageerror",e=>browserErrors.push(e.message));
 await page.goto("/register");await page.getByLabel("Nume complet").fill("Ana Popescu");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Parolă",{exact:true}).fill(password);await page.getByLabel("Confirmă parola").fill(password);await page.getByRole("button",{name:"Creează contul",exact:true}).click();await expect(page.getByRole("status")).toContainText("Verificați emailul");
 await signIn(page,email);await expect(page).toHaveURL(/onboarding/);
 await page.getByLabel("Denumirea organizației").fill("Clinica Test Browser");await page.getByLabel("Prima locație").fill("Oradea");await page.getByRole("button",{name:"Creează spațiul de lucru"}).click();
 await expect(page.getByRole("heading",{name:"Clinica",exact:true})).toBeVisible();await page.getByLabel("Email clinică",{exact:true}).fill("contact@clinica-test.ro");await page.getByRole("button",{name:"Continuă",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Locații",exact:true})).toBeVisible();await page.getByLabel("Oraș",{exact:true}).fill("Oradea");await page.getByRole("button",{name:"Continuă",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Program",exact:true})).toBeVisible();await page.getByRole("button",{name:"Continuă",exact:true}).click();
 await page.getByRole("button",{name:"Adaugă serviciu",exact:true}).click();let record=page.locator(".setup-record").nth(0);await record.getByLabel("Denumire serviciu").fill("Consultație");await record.getByLabel("Preț (RON)").fill("200");
 await page.getByRole("button",{name:"Adaugă serviciu",exact:true}).click();record=page.locator(".setup-record").nth(1);await record.getByLabel("Denumire serviciu").fill("Control");await record.getByLabel("Preț (RON)").fill("100");await record.getByLabel("Durată (minute)").fill("15");await page.getByRole("button",{name:"Continuă",exact:true}).click();
 for(const [index,first,last] of [[0,"Ana","Popescu"],[1,"Mihai","Ionescu"]] as const){await page.getByRole("button",{name:"Adaugă medic",exact:true}).click();record=page.locator(".setup-record").nth(index);await record.getByLabel("Prenume",{exact:true}).fill(first);await record.getByLabel("Nume",{exact:true}).fill(last);await record.getByRole("checkbox",{name:"Consultație · Oradea",exact:true}).check();await record.getByRole("checkbox",{name:"Control · Oradea",exact:true}).check();}
 await page.getByRole("button",{name:"Continuă",exact:true}).click();await page.getByRole("button",{name:"Adaugă cabinet",exact:true}).click();await page.getByLabel("Denumire cabinet").fill("Cabinet 1");await page.getByRole("button",{name:"Continuă",exact:true}).click();await page.getByRole("button",{name:"Adaugă coleg",exact:true}).click();await page.getByLabel("Email coleg").fill("onboarding-colleague@clinica-test.ro");await page.getByRole("button",{name:"Continuă",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Finalizare",exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("heading",{name:"Finalizare",exact:true})).toBeVisible();await page.getByRole("button",{name:"Înapoi",exact:true}).click();await expect(page.getByRole("heading",{name:"Echipă",exact:true})).toBeVisible();await page.getByRole("button",{name:"Continuă",exact:true}).click();
 for(const width of [1920,1440,1024,768,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/onboarding-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1440,height:900});await page.getByRole("button",{name:"Finalizează configurarea"}).click();await expect(page.getByRole("link",{name:"Intră în spațiul de lucru"})).toBeVisible();await expect(page.getByLabel("onboarding-colleague@clinica-test.ro")).toHaveValue(/\/invitations\/[A-Za-z0-9_-]{43}$/);await page.getByRole("link",{name:"Intră în spațiul de lucru"}).click();await expect(page.getByRole("heading",{name:"Spațiul de lucru"})).toBeVisible();const base=new URL(page.url()).pathname;
 await page.goto(`${base}/patients`);await page.getByRole("button",{name:"Adaugă pacient",exact:true}).first().click();let dialog=page.getByRole("dialog");await dialog.getByLabel("Nume și prenume").fill("Ion Popescu");await dialog.getByLabel("Identificator intern").fill("TEST-ION");await dialog.getByLabel("CNP (opțional)",{exact:true}).fill("1234567890123");await dialog.getByRole("button",{name:"Creează înregistrarea"}).click();await expect(page.getByRole("heading",{name:"Ion Popescu",exact:true})).toBeVisible();
 const day=new Date();day.setUTCDate(day.getUTCDate()+2);while([0,6].includes(day.getUTCDay()))day.setUTCDate(day.getUTCDate()+1);const date=day.toISOString().slice(0,10);const dateRo=date.split("-").reverse().join(".");
 await page.goto(`${base}/calendar?view=day&date=${date}`);await page.getByRole("button",{name:"Programare nouă",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByLabel("Caută pacient").fill("Ion Popescu");await dialog.getByRole("button",{name:/Ion Popescu/}).click();await dialog.getByLabel("Serviciu",{exact:true}).selectOption({label:"Consultație"});await dialog.getByLabel("Medic",{exact:true}).selectOption({label:"Ana Popescu"});await dialog.getByLabel("Data",{exact:true}).fill(dateRo);await page.keyboard.press("Tab");await expect(dialog.locator(".slot-picker button").first()).toBeVisible();await dialog.locator(".slot-picker button").filter({hasText:/^10:00$/}).click();await dialog.getByRole("button",{name:"Creează programarea"}).click();await expect(page.getByRole("button",{name:/Ion Popescu/})).toBeVisible();await page.reload();await expect(page.getByRole("button",{name:/Ion Popescu/})).toBeVisible();
 await page.getByRole("button",{name:"Deconectare",exact:true}).click();await expect(page).toHaveURL(/login/);await signIn(page,email);await expect(page.getByRole("heading",{name:"Spațiul de lucru"})).toBeVisible();await page.goto(`${base}/calendar?view=day&date=${date}`);await expect(page.getByRole("button",{name:/Ion Popescu/})).toBeVisible();
 await page.goto(`${base}/team`);await page.getByLabel("Email coleg").fill("colleague@clinica-test.ro");await page.getByRole("button",{name:"Creează invitația",exact:true}).click();await expect(page.getByLabel("Link de invitație · valabil 7 zile")).toHaveValue(/\/invitations\/[A-Za-z0-9_-]{43}$/);
 expect(browserErrors).toEqual([]);
});
test("recovery form is available and direct anonymous password reset is protected",async({page})=>{
 await page.goto("/reset-password");await expect(page).toHaveURL(/login/);await page.goto("/forgot-password");await page.getByLabel("Email").fill("owner@voxa.test");await page.getByRole("button",{name:"Trimite linkul"}).click();await expect(page.getByRole("status")).toContainText("Dacă adresa are un cont");
});

test("one recovery submission stays locked until an explicit new request",async({page,request})=>{
 const baseline=await (await request.get("http://127.0.0.1:54329/test/auth-request-counts")).json();
 await page.goto("/forgot-password");await page.getByLabel("Email").fill("owner@voxa.test");
 await page.getByRole("button",{name:"Trimite linkul",exact:true}).dblclick();
 await expect(page.getByRole("status")).toContainText("Dacă adresa are un cont");
 await expect(page.getByRole("button",{name:"Link solicitat",exact:true})).toBeDisabled();
 // Even a second programmatic submit cannot queue another server action.
 await page.locator("form").evaluate((form:HTMLFormElement)=>form.requestSubmit());
 expect((await (await request.get("http://127.0.0.1:54329/test/auth-request-counts")).json()).recover).toBe(baseline.recover+1);
 await expect(page.getByText("Folosiți linkul din cel mai recent email.",{exact:false})).toBeVisible();
 await page.getByRole("link",{name:"Solicită un nou link sau folosește altă adresă"}).click();
 await expect(page.getByRole("button",{name:"Trimite linkul",exact:true})).toBeEnabled();
});

test("email scans and legacy recovery GETs do not consume a token; explicit POST does",async({page,request})=>{
 const baseline=await (await request.get("http://127.0.0.1:54329/test/auth-request-counts")).json();
 const hash="a".repeat(64);
 const response=await request.get(`/auth/callback?token_hash=${hash}&type=recovery&next=https://evil.invalid`,{maxRedirects:0});
 expect(response.status()).toBe(307);expect(response.headers()["location"]).toBe(`http://localhost:3100/auth/recovery?token_hash=${hash}`);
 expect(response.headers()["cache-control"]).toContain("no-store");expect(response.headers()["referrer-policy"]).toBe("no-referrer");
 await page.goto(`/auth/recovery?token_hash=${hash}`);await page.reload();
 await expect(page.getByRole("heading",{name:"Continuă recuperarea parolei"})).toBeVisible();
 expect((await (await request.get("http://127.0.0.1:54329/test/auth-request-counts")).json()).verify).toBe(baseline.verify);
 await page.getByRole("button",{name:"Continuă",exact:true}).click();
 await expect(page.getByRole("alert").filter({hasText:"Linkul a expirat"})).toContainText("Linkul a expirat, a fost deja folosit sau a fost înlocuit");
 expect((await (await request.get("http://127.0.0.1:54329/test/auth-request-counts")).json()).verify).toBe(baseline.verify+1);
 await page.goto("/auth/recovery?token_hash=short");await expect(page.getByRole("alert").filter({hasText:"Linkul nu este valid"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Continuă",exact:true})).toHaveCount(0);
});
