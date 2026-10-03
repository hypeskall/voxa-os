import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { stagingEnv } from "../../scripts/staging-env.mjs";
const config=stagingEnv();
test("genuine expired access token and revoked refresh session cannot enter hosted routes",async({page,context,request})=>{
 const file=".staging-deploy/expired-session.local.json";
 test.skip(!fs.existsSync(file),"Prepare a genuine short-lived Auth session; never forge a token to simulate expiry.");
 const fixture=JSON.parse(fs.readFileSync(file,"utf8"));
 expect(Date.now()>=fixture.expiresAt+2000,"Wait for the real Supabase-issued token to expire before running this probe").toBe(true);
 const headers:Record<string,string>=config.env.STAGING_PREVIEW_BYPASS_SECRET?{"x-vercel-protection-bypass":config.env.STAGING_PREVIEW_BYPASS_SECRET}:{};
 if(config.env.STAGING_PREVIEW_BYPASS_SECRET)await context.route(`${config.origin}/**`,route=>route.continue({headers:{...route.request().headers(),...headers}}));
 await expect.poll(async()=>{const r=await request.get("/api/staging/status",{headers,maxRedirects:0});if(r.status()!==200||!r.headers()["content-type"]?.includes("application/json"))return false;const m=await r.json();return m.environment==="staging"&&m.supabaseProjectRef===config.ref&&m.origin===config.origin;},{timeout:30000}).toBe(true);
 const client=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const user=await client.auth.getUser(fixture.accessToken);expect(Boolean(user.error)&&!user.data.user).toBe(true);
 const refresh=await client.auth.refreshSession({refresh_token:fixture.refreshToken});expect(Boolean(refresh.error)&&!refresh.data.session).toBe(true);
 const actors=JSON.parse(fs.readFileSync(".staging-actors.local.json","utf8"));
 for(const route of ["/dashboard","/reset-password",`/clinics/${actors.a.clinicId}/patients`]){
  await context.clearCookies();await context.addCookies(fixture.cookies.map((cookie:{name:string;value:string})=>({...cookie,url:config.origin,httpOnly:true,secure:true,sameSite:"Lax" as const})));
  await page.goto(route);await expect(page).toHaveURL(/\/login/);await expect(page.locator(".app-shell")).toHaveCount(0);
 }
});
