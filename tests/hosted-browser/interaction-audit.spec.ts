import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
const config=stagingEnv();
const actor=JSON.parse(fs.readFileSync(".staging-deploy/pilot-actor.local.json","utf8"));
if(actor.ref!==config.ref || !actor.clinicId)throw new Error("A separate synthetic clinic fixture is required for the audit.");
const base=`/clinics/${actor.clinicId}`;
const timings:{action:string;milliseconds:number}[]=[];
test.beforeEach(async({context,request})=>{
  const bypass=config.env.STAGING_PREVIEW_BYPASS_SECRET;
  const headers:Record<string,string>=bypass?{"x-vercel-protection-bypass":bypass}:{};
  if(bypass)await context.route(`${config.origin}/**`,route=>route.continue({headers:{...route.request().headers(),...headers}}));
  const response=await request.get("/api/staging/status",{headers});
  expect(response.status()).toBe(200);
  const status=await response.json();expect(status.environment==="staging"&&status.supabaseProjectRef===config.ref).toBe(true);
});
test.afterAll(()=>{
  fs.writeFileSync(".staging-deploy/audit-hosted-ui.receipt.json",JSON.stringify({verifiedAt:new Date().toISOString(),origin:config.origin,timings},null,2));
});
async function login(page:Page){
  await page.goto("/login");await page.getByLabel("Utilizator").fill(actor.email);
  await page.getByLabel("Parolă",{exact:true}).fill(actor.password);
  await page.getByRole("button",{name:"Conectare",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Spațiul de lucru",exact:true})).toBeVisible();
}
function measured(action:string,start:number){
  const entry={action,milliseconds:Math.round(performance.now()-start)};
  timings.push(entry);console.log(JSON.stringify(entry));
}
test("hosted workspace navigation renders all principal modules without browser errors",async({page})=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const failed:number[]=[];page.on("response",r=>{if(r.status()>=500)failed.push(r.status());});
  await login(page);
  for(const label of ["Calendar","Pacienți","Medici","Servicii","Disponibilitate","Resurse","Setări","Spațiu de lucru"]){
    const start=performance.now();
    await page.getByRole("navigation",{name:"Navigație principală"}).getByRole("link",{name:label,exact:true}).click();
    try {
      const heading=label==="Servicii"?"Servicii și investigații":label==="Spațiu de lucru"?"Spațiul de lucru":label;
      await expect(page.getByRole("heading",{name:heading,exact:true}).first()).toBeVisible();
    } catch (error) {
      console.log(JSON.stringify({route:new URL(page.url()).pathname,headings:await page.getByRole("heading").allTextContents(),browserErrors:errors}));
      await page.screenshot({path:".staging-deploy/audit-navigation-failure.png"});
      throw error;
    }
    await expect(page.getByRole("status",{name:"Se încarcă pagina"})).toHaveCount(0);
    measured(`navigation:${label}`,start);
  }
  expect(errors).toEqual([]);expect(failed).toEqual([]);
});
for(const width of [1440,1024,390])test(`hosted appointment form closes cleanly at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await login(page);await page.goto(`${base}/calendar?view=week`);
  await expect(page.locator(".calendar-shell")).toBeVisible();
  const bounds=await page.locator(".calendar-shell").boundingBox();
  for(const close of ["button","escape"]){
    const start=performance.now();await page.getByRole("button",{name:"Programare nouă",exact:true}).click();
    await expect(page.getByRole("dialog")).toBeVisible();measured(`form-open:${width}`,start);
    const closing=performance.now();
    const animations=await page.evaluate(async method=>{
      if(method==="button")(document.querySelector('.dialog-close') as HTMLButtonElement).click();
      else document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
      await new Promise(requestAnimationFrame);
      return [...document.querySelectorAll('.dialog-content[data-state="closed"],.dialog-overlay[data-state="closed"]')].map(e=>getComputedStyle(e).animationName);
    },close);
    expect(animations.every(name=>name==="none")).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);measured(`form-close:${close}:${width}`,closing);
    expect(await page.evaluate(()=>getComputedStyle(document.body).pointerEvents)).toBe("auto");
    const after=await page.locator(".calendar-shell").boundingBox();
    expect(Math.abs(after!.x-bounds!.x)).toBeLessThan(1);expect(Math.abs(after!.width-bounds!.width)).toBeLessThan(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
test("hosted date navigation does not send a preference write and empty search completes",async({page})=>{
  await login(page);await page.goto(`${base}/calendar?view=week`);
  await expect(page.getByRole("heading",{name:"Calendar",exact:true})).toBeVisible();
  const methods:string[]=[];
  page.on("request",r=>{if(new URL(r.url()).pathname===`${base}/calendar`)methods.push(r.method());});
  const start=performance.now();await page.getByRole("button",{name:"Perioada următoare",exact:true}).click();
  await expect(page).toHaveURL(/date=/);await expect(page.locator(".calendar-shell")).toHaveAttribute("aria-busy","false");
  measured("calendar-next-period",start);expect(methods[0]).toBe("GET");expect(methods.includes("POST")).toBe(false);
  await page.getByRole("button",{name:"Programare nouă",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Caută pacient").fill("NoSyntheticPatientMatchesThisQuery");
  await expect(page.getByRole("dialog").getByText("Nu există pacienți care corespund căutării.",{exact:true})).toBeVisible();
});
