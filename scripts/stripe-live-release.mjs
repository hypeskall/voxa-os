import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { readEnv } from "./staging-env.mjs";
import { validateLiveTarget } from "./stripe-live-setup.mjs";
import { STRIPE_API_VERSION, assertMonthlyPrice } from "../src/features/subscriptions/stripe-model.ts";

const root=path.resolve(".");
const production=readEnv(".env.production.local");
const settings=readEnv(".env.stripe-live.local");
validateLiveTarget(production,settings);
const project=JSON.parse(fs.readFileSync(".staging-deploy/notification-production-project.local.json","utf8"));
if(project.projectName!=="voxa-os" || project.projectId!=="prj_s89u9ys6auqD0nFhjIevV4PKgyjG")throw new Error("Unexpected live deployment project.");
const auth=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,"com.vercel.cli/Data/auth.json"),"utf8"));
const values=Object.fromEntries(["STRIPE_SECRET_KEY","STRIPE_ACCOUNT_ID","STRIPE_PRICE_ID","STRIPE_WEBHOOK_SECRET","STRIPE_PORTAL_CONFIGURATION_ID"].map(key=>[key,settings[key]]));
if(Object.values(values).some(value=>!value))throw new Error("Complete the live Stripe setup first.");
Object.assign(values,{STRIPE_BILLING_ENABLED:"true",STRIPE_BILLING_MODE:"live"});
try{
  const stripe=new Stripe(settings.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION,timeout:20000});
  const [account,balance,price]=await Promise.all([stripe.accounts.retrieve(null),stripe.balance.retrieve(),stripe.prices.retrieve(settings.STRIPE_PRICE_ID)]);
  if(account.id!==settings.STRIPE_ACCOUNT_ID || !balance.livemode || !account.charges_enabled)throw new Error("Live account verification failed.");
  assertMonthlyPrice(price,true);
  if(process.argv[2]==="configure"){
    const response=await fetch(`https://api.vercel.com/v10/projects/${project.projectId}/env?slug=voxa6&upsert=true`,{
      method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},
      body:JSON.stringify(Object.entries(values).map(([key,value])=>({key,value,type:/SECRET/.test(key)?"sensitive":"encrypted",target:["production"]}))),
      signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Live environment configuration failed (HTTP ${response.status}).`);
    const lines=fs.readFileSync(".env.production.local","utf8").split(/\r?\n/).filter(line=>!Object.keys(values).some(key=>line.startsWith(key+"=")));
    fs.writeFileSync(".env.production.local",lines.join("\n").trimEnd()+"\n"+Object.entries(values).map(([key,value])=>`${key}=${value}`).join("\n")+"\n");
    console.log("PASS: live Stripe variables saved only to production, with server secrets marked sensitive.");
  }else if(process.argv[2]==="deploy"){
    if (process.argv[3] === "--audit-scope") {
      // This guarded release must differ from the verified published snapshot
      // only in the specific files changed by the reception/results audit.
      const allowed = new Set([
        "CONTEXT_COMPLET_VOXA_PENTRU_GPT_2026-10-05.md", "README.md", "PRODUCTION_CHECKLIST.md",
        "docs/PERFORMANCE_AUDIT_2026-10-05.md", "docs/DEEP_AUDIT_2026-10-05.md",
        "docs/deep-audit-doctors.png", "docs/deep-audit-services.png", "docs/deep-audit-portal.png",
        "scripts/stripe-live-release.mjs", "supabase/migrations/202610050040_reception_results.sql",
        "src/features/results/result-composer.tsx", "tests/browser/deep-audit.spec.ts",
        "tests/hosted-browser/reception-results.spec.ts", "tests/reception-results.test.ts",
        "src/app/clinics/[clinicId]/notifications/page.tsx", "src/app/clinics/[clinicId]/results/[id]/page.tsx",
        "src/app/clinics/[clinicId]/results/page.tsx", "src/app/error.tsx", "src/app/globals.css",
        "src/app/portal/page.tsx", "src/components/shell.tsx", "src/features/core-clinic/catalog-registry.tsx",
        "src/features/core-clinic/detail.tsx", "src/features/documents/actions.ts", "src/features/documents/data.ts",
        "src/features/patient-portal/activate-portal.tsx", "src/features/patient-portal/patient-activity.tsx",
        "src/features/results/model.ts", "src/features/results/patient-results.tsx", "src/lib/locale/ro.ts",
        "src/types/database.ts", "tests/fixtures/supabase.mjs", "tests/rls.test.ts",
      ]);
      const receipt = JSON.parse(fs.readFileSync(".staging-deploy/deep-audit-scope.receipt.json", "utf8"));
      const baseline = path.resolve(".staging-deploy/live-release-1791156300556");
      if (receipt.baselineDeployment !== "dpl_5RhUvDF7VwpGHcAa3PzDQF4cVPvc" || receipt.baselineFolder !== baseline)
        throw new Error("Audit baseline mismatch.");
      const inventory = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
      if (inventory.status !== 0) throw new Error("Audit inventory failed.");
      const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
      const changes = inventory.stdout.trim().split(/\r?\n/).filter(file => !fs.existsSync(path.join(baseline,file)) || hash(file) !== hash(path.join(baseline,file)));
      if (changes.length !== receipt.changes.length || changes.some(file => !allowed.has(file) || !receipt.changes.some(item => item.file === file && item.sha256 === hash(file))))
        throw new Error("Release scope changed or contains unrelated files. Refusing deployment.");
      console.log(`PASS: guarded audit scope: ${changes.length} authorized files differ from the verified published baseline; all other source files are identical.`);
    } else if (process.argv[3]) throw new Error("Unknown release scope.");
    if(production.STRIPE_BILLING_MODE!=="live" || production.STRIPE_BILLING_ENABLED!=="true")throw new Error("Configure live variables before deployment.");
    const verify=spawnSync(process.execPath,["scripts/production-release.mjs","check"],{cwd:root,encoding:"utf8",timeout:60000});
    if(verify.status!==0 || !verify.stdout.includes("production matches the current application")
      || verify.stdout.includes("Pending forward migrations"))throw new Error("Production schema must match the current application before live deployment.");
    const folder=path.join(root,`.staging-deploy/live-release-${Date.now()}`);
    fs.mkdirSync(folder,{recursive:true});
    const inventory=spawnSync("git",["ls-files","--cached","--others","--exclude-standard"],{encoding:"utf8"});
    if(inventory.status!==0)throw new Error("Cannot inventory live source.");
    for(const relative of inventory.stdout.trim().split(/\r?\n/)){
      const source=path.resolve(root,relative),target=path.resolve(folder,relative);
      if(!source.startsWith(root+path.sep) || !target.startsWith(folder+path.sep))throw new Error("Invalid source path.");
      if(!fs.existsSync(source))continue;
      if(!fs.statSync(source).isFile())throw new Error("Invalid source file.");
      if(/^\.env/.test(relative) && !relative.endsWith(".example"))throw new Error("Private environment file in source inventory.");
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
    }
    fs.mkdirSync(path.join(folder,".vercel"),{recursive:true});
    fs.writeFileSync(path.join(folder,".vercel/project.json"),JSON.stringify({projectId:project.projectId,orgId:project.orgId,projectName:project.projectName}));
    const release=spawnSync(process.env.ComSpec||"cmd.exe",["/d","/s","/c","npx --yes vercel@62.2.0 deploy --prod --yes --scope voxa6 --no-clipboard"],{
      cwd:folder,encoding:"utf8",timeout:300000});
    if(release.error || release.status!==0)throw new Error("Live production deployment failed; private diagnostics suppressed.");
    const url=release.stdout.match(/https:\/\/voxa-[a-z0-9-]+-voxa6\.vercel\.app/)?.[0];
    if(!url)throw new Error("Live deployment URL not acknowledged.");
    fs.writeFileSync(".staging-deploy/stripe-live-deployment.local.json",JSON.stringify({url,createdAt:new Date().toISOString(),accountId:account.id,mode:"live"}));
    console.log("PASS: live Stripe and Voxa favicon deployed to production. Verify the public site and webhook before completing acceptance.");
  }else throw new Error("Use configure or deploy.");
}catch(error){console.error(error instanceof Stripe.errors.StripeError?"Stripe live verification failed; private provider diagnostics suppressed.":error.message);process.exitCode=1;}
