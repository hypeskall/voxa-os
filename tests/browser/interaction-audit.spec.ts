import { test, expect, type Page } from "@playwright/test";
const base="/clinics/30000000-0000-4000-8000-000000000001";
async function calendar(page:Page){
  await page.goto("/login");
  await page.getByLabel("Utilizator").fill("owner@voxa.test");
  await page.getByLabel("Parolă",{exact:true}).fill("VoxaDev!2026");
  await page.getByRole("button",{name:"Conectare",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Spațiul de lucru",exact:true})).toBeVisible();
  await page.goto(`${base}/calendar?view=week`);
  await expect(page.getByRole("heading",{name:"Calendar",exact:true})).toBeVisible();
}
for(const width of [1440,390])test(`appointment close has no reappearing animation, scroll lock or layout drift at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await calendar(page);
  const bounds=await page.locator(".calendar-shell").boundingBox();
  for(const close of ["button","escape"]){
    await page.getByRole("button",{name:"Programare nouă",exact:true}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Note",{exact:true}).fill("Draft to discard");
    // Capture the first paint after the real close event, before a bad exit
    // animation could finish and hide the flash from a normal visibility check.
    const closed=await page.evaluate(async(method)=>{
      if(method==="button") (document.querySelector('.dialog-close') as HTMLButtonElement).click();
      else document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
      await new Promise(requestAnimationFrame);
      return Array.from(document.querySelectorAll('.dialog-content[data-state="closed"],.dialog-overlay[data-state="closed"]')).map(e=>getComputedStyle(e).animationName);
    },close);
    expect(closed.every(name=>name==="none")).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(()=>getComputedStyle(document.body).pointerEvents)).toBe("auto");
    const after=await page.locator(".calendar-shell").boundingBox();
    expect(Math.abs(after!.x-bounds!.x)).toBeLessThan(1);
    expect(Math.abs(after!.width-bounds!.width)).toBeLessThan(1);
  }
});

test("patient lookup terminates empty and failed searches without an uncaught exception",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await calendar(page);await page.getByRole("button",{name:"Programare nouă",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Caută pacient").fill("NothingMatchesThisSyntheticQuery");
  await expect(dialog.getByText("Nu există pacienți care corespund căutării.",{exact:true})).toBeVisible();
  await page.route(`${base}/data/patients`,route=>route.fulfill({status:503,json:{error:"Synthetic outage"}}));
  await dialog.getByLabel("Caută pacient").fill("Outage");
  await expect(dialog.getByText("Căutarea nu a reușit.",{exact:false})).toBeVisible();
  expect(errors).toEqual([]);
});

test("global search aborts an obsolete query before the next debounce expires",async({page})=>{
  await calendar(page);
  let staleStarted:()=>void=()=>{};
  const firstStarted=new Promise<void>(resolve=>{staleStarted=resolve;});
  await page.route("**/api/clinics/*/search",async route=>{
    const query=route.request().postDataJSON().query;
    if(query==="OldQuery"){staleStarted();await new Promise(resolve=>setTimeout(resolve,120));}
    await route.fulfill({json:{results:[{kind:"patient",id:"50000000-0000-4000-8000-000000000001",title:query,subtitle:"Synthetic result",href:`${base}/patients`}]}}).catch(()=>{});
  });
  await page.getByRole("button",{name:/Caută în clinică/}).click();
  await page.getByLabel("Termen de căutare").fill("OldQuery");await firstStarted;
  await page.getByLabel("Termen de căutare").fill("NewQuery");
  await page.waitForTimeout(160);
  await expect(page.getByRole("option",{name:/OldQuery/})).toHaveCount(0);
  await expect(page.getByRole("option",{name:/NewQuery/})).toBeVisible();
});

test("calendar changes period with no preference save in front of navigation",async({page})=>{
  await calendar(page);
  const methods:string[]=[];
  page.on("request",request=>{if(new URL(request.url()).pathname===`${base}/calendar`)methods.push(request.method());});
  await page.getByRole("button",{name:"Perioada următoare",exact:true}).click();
  await expect(page).toHaveURL(/date=/);
  await expect(page.locator(".calendar-shell")).toHaveAttribute("aria-busy","false");
  expect(methods[0]).toBe("GET");
  expect(methods.filter(method=>method==="POST")).toHaveLength(0);
});

test("public availability ignores a slow result for the previous date",async({page})=>{
  await page.goto("/book/clinica-centru");
  await page.getByRole("button",{name:/Consultație inițială/}).click();
  await page.getByRole("button",{name:/Continuă/}).click();
  await page.getByRole("button",{name:/Primul medic disponibil/}).click();
  await page.getByRole("button",{name:/Continuă/}).click();
  const first=new Date();first.setUTCDate(first.getUTCDate()+10);
  const second=new Date(first);second.setUTCDate(second.getUTCDate()+1);
  const oldDate=first.toISOString().slice(0,10),newDate=second.toISOString().slice(0,10);
  let began:()=>void=()=>{};const oldStarted=new Promise<void>(resolve=>{began=resolve;});
  await page.route("**/api/public/availability?**",async route=>{
    const date=new URL(route.request().url()).searchParams.get("date")!;
    if(date===oldDate){began();await new Promise(resolve=>setTimeout(resolve,700));}
    await route.fulfill({json:[{start_at:`${date}T${date===oldDate?"07":"08"}:00:00Z`,end_at:`${date}T09:00:00Z`,doctor_id:null}]}).catch(()=>{});
  });
  await page.getByLabel("Data programării").fill(oldDate);await oldStarted;
  await page.getByLabel("Data programării").fill(newDate);
  await expect(page.locator(".public-slot-grid button")).toHaveCount(1);
  const correct=await page.locator(".public-slot-grid").innerText();
  await page.waitForTimeout(800);
  await expect(page.locator(".public-slot-grid")).toHaveText(correct);
});
