import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import Stripe from "stripe";
import { readEnv } from "./staging-env.mjs";
import { managementQuery } from "./staging-schema.mjs";
import { runMonitor } from "./uptime-check.mjs";
import { STRIPE_API_VERSION } from "../src/features/subscriptions/stripe-model.ts";
const env=readEnv(".env.production.local");
const ref="fibcbsdattoqiyizzeda",origin="https://voxa-os.vercel.app";
if(env.APP_ORIGIN!==origin || env.NEXT_PUBLIC_SUPABASE_URL!==`https://${ref}.supabase.co` || env.STRIPE_BILLING_MODE!=="live")
  throw new Error("Unexpected live acceptance target.");
try{
  const stripe=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION,timeout:20000});
  const [account,balance]=await Promise.all([stripe.accounts.retrieve(null),stripe.balance.retrieve()]);
  if(account.id!==env.STRIPE_ACCOUNT_ID || !balance.livemode || !account.charges_enabled)throw new Error("Live account verification failed.");
  const events=[true,false].map(livemode=>({id:`evt_voxa_acceptance_${randomUUID().replaceAll("-","")}`,object:"event",livemode,type:"invoice.paid",
    data:{object:{id:"in_voxa_acceptance",object:"invoice",customer:"cus_voxa_acceptance_unmapped"}}}));
  const before=await managementQuery(ref,env.SUPABASE_ACCESS_TOKEN,"select count(*) n from public.organization_stripe_billing");
  const statuses=[];
  for(const event of events){
    const payload=JSON.stringify(event);
    const signature=stripe.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET});
    const response=await fetch(`${origin}/api/stripe/webhook`,{method:"POST",redirect:"error",headers:{"content-type":"application/json","stripe-signature":signature},body:payload,signal:AbortSignal.timeout(30000)});
    statuses.push(response.status);await response.body?.cancel();
  }
  if(statuses[0]!==200 || statuses[1]!==400)throw new Error("Live webhook mode acceptance failed.");
  const invalid=await fetch(`${origin}/api/stripe/webhook`,{method:"POST",redirect:"error",headers:{"content-type":"application/json","stripe-signature":"invalid"},body:"{}",signal:AbortSignal.timeout(30000)});
  if(invalid.status!==400)throw new Error("Invalid signature was not rejected.");
  await invalid.body?.cancel();
  const after=await managementQuery(ref,env.SUPABASE_ACCESS_TOKEN,"select count(*) n from public.organization_stripe_billing");
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error("Acceptance unexpectedly changed billing mappings.");
  const homepage=await fetch(origin,{redirect:"error",signal:AbortSignal.timeout(30000)});
  if(!homepage.ok)throw new Error("Homepage unavailable.");
  const html=await homepage.text();
  if(!html.includes('rel="icon"') || !html.includes("/icon.svg") || !html.includes("/apple-icon.png"))throw new Error("Homepage icon metadata missing.");
  for(const icon of ["favicon.ico","icon.svg","apple-icon.png"]){
    const response=await fetch(`${origin}/${icon}`,{redirect:"error",signal:AbortSignal.timeout(30000)});
    const bytes=Buffer.from(await response.arrayBuffer());
    if(!response.ok || createHash("sha256").update(bytes).digest("hex")!==createHash("sha256").update(fs.readFileSync(`src/app/${icon}`)).digest("hex"))
      throw new Error("Production icon does not match the Voxa logo asset.");
  }
  const readiness=await runMonitor(origin);
  if(readiness.some(item=>!item.ok))throw new Error("Production readiness failed.");
  const receipt={verifiedAt:new Date().toISOString(),ref,liveAccountReady:true,liveEventAccepted:statuses[0],signedSandboxEventRejected:statuses[1],invalidSignatureRejected:invalid.status,
    billingMappingsUnchanged:true,iconsVerified:true,productionReadiness:readiness.length,realCustomerCharged:false};
  fs.writeFileSync(".staging-deploy/stripe-live-acceptance.receipt.json",JSON.stringify(receipt));
  console.log(JSON.stringify(receipt));
  console.log("PASS: live production account/webhook, test-mode rejection, signature protection, readiness and all Voxa icon assets verified; no customer charged.");
}catch(error){console.error(error instanceof Stripe.errors.StripeError?"Stripe rejected live acceptance; provider diagnostics suppressed.":error.message);process.exitCode=1;}
