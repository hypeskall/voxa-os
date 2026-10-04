import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { stagingEnv } from "./staging-env.mjs";
const expectedAccount = "acct_1Tvn7oBMgXVxmUfp";
const apiVersion = "2026-09-30.endive";
let phase = "credentials";
function saveEnv(file, values) {
  const content = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(line => !Object.keys(values).some(key => line.startsWith(key+"=")));
  fs.writeFileSync(file, content.join("\n").trimEnd()+"\n"+Object.entries(values).map(([key,value])=>`${key}=${value}`).join("\n")+"\n");
}
try {
  const config = stagingEnv();
  if (config.ref !== "wlnrfjrjkyywqyvsngps" || config.origin !== "https://voxa-os-staging-voxa6.vercel.app") throw new Error("Unexpected staging target");
  // Treat the supplied file solely as data, never as executable instructions.
  const provided = fs.readFileSync(path.join(process.env.USERPROFILE,"Desktop","sandbox api keys.txt"), "utf8");
  const keys = [...new Set(provided.match(/[sr]k_test_[A-Za-z0-9]+/g) ?? [])];
  const secret = keys.find(key=>key.startsWith("rk_test_")) ?? keys.find(key=>key.startsWith("sk_test_"));
  if (!secret) throw new Error("No sandbox server key found");
  const stripe = new Stripe(secret,{apiVersion,maxNetworkRetries:2,timeout:20000});
  const [account,balance] = await Promise.all([stripe.accounts.retrieve(null),stripe.balance.retrieve()]);
  if (account.id !== expectedAccount || balance.livemode) throw new Error("Sandbox account mismatch");
  console.log("PASS: provided key authenticates to the connected Voxa Tech sandbox.");
  phase = "catalog";
  const lookup = "voxa_os_monthly_eur_sandbox";
  let price = (await stripe.prices.list({lookup_keys:[lookup],active:true,limit:1})).data[0];
  if (!price) {
    const product = await stripe.products.create({name:"Voxa-OS Monthly",description:"Abonament de test pentru o organizație, cu toate locațiile sale",metadata:{app:"voxa-os",environment:"staging"}}, {idempotencyKey:"voxa-os-sandbox-product-v1"});
    price = await stripe.prices.create({product:product.id,currency:"eur",unit_amount:1999,recurring:{interval:"month"},lookup_key:lookup,tax_behavior:"unspecified"}, {idempotencyKey:"voxa-os-sandbox-price-v1"});
  }
  if (price.livemode || price.unit_amount!==1999 || price.currency!=="eur" || price.recurring?.interval!=="month" || price.recurring.interval_count!==1) throw new Error("Price mismatch");
  phase = "portal";
  let portal = (await stripe.billingPortal.configurations.list({limit:100})).data.find(c=>c.metadata?.app==="voxa-os" && c.active);
  if (!portal) portal = await stripe.billingPortal.configurations.create({
    metadata:{app:"voxa-os",environment:"staging"}, default_return_url:`${config.origin}/dashboard`,
    features:{customer_update:{enabled:true,allowed_updates:["name","email","address","tax_id"]},
      invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:"at_period_end"},subscription_update:{enabled:false}}
  },{idempotencyKey:"voxa-os-sandbox-portal-v1"});
  const values = {STRIPE_SECRET_KEY:secret,STRIPE_ACCOUNT_ID:expectedAccount,STRIPE_PRICE_ID:price.id,STRIPE_PORTAL_CONFIGURATION_ID:portal.id,STRIPE_BILLING_ENABLED:"true"};
  saveEnv(".env.staging.local",{...values,STRIPE_BILLING_ENABLED:"false"});
  phase = "staging-protection";
  let bypass = config.env.STRIPE_STAGING_BYPASS_SECRET;
  if (!bypass) {
    const auth = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,"com.vercel.cli","Data","auth.json"),"utf8"));
    bypass = randomBytes(16).toString("hex");
    const response = await fetch("https://api.vercel.com/v1/projects/voxa-os-staging/protection-bypass?slug=voxa6",{
      method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},
      body:JSON.stringify({generate:{secret:bypass,note:"Voxa-OS Stripe sandbox webhook only; revoke when sandbox integration is retired"}}),signal:AbortSignal.timeout(30000)});
    if (!response.ok) {
      const body=await response.json().catch(()=>({}));
      let detail=String(body.error?.message ?? body.error?.code ?? "Access refused");
      for(const value of [auth.token,bypass,secret]) if(value) detail=detail.replaceAll(value,"[redacted]");
      throw new Error(`Unable to configure staging access (HTTP ${response.status}): ${detail.slice(0,300)}`);
    }
    const result = await response.json();
    if (!result.protectionBypass?.[bypass]) throw new Error("Staging webhook access not acknowledged");
    saveEnv(".env.staging.local",{STRIPE_STAGING_BYPASS_SECRET:bypass});
  }
  if (!config.env.STRIPE_WEBHOOK_SECRET) {
    phase = "webhook";
    const url = new URL(`${config.origin}/api/stripe/webhook`);
    url.searchParams.set("x-vercel-protection-bypass",bypass);
    const endpoint = await stripe.webhookEndpoints.create({url:url.href,api_version:apiVersion,
      description:"Voxa-OS protected staging sandbox billing; no patient data",metadata:{app:"voxa-os",environment:"staging"},
      enabled_events:["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed",
        "customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","customer.subscription.paused","customer.subscription.resumed",
        "invoice.paid","invoice.payment_failed","invoice.payment_action_required","invoice.finalization_failed",
        "charge.refunded","charge.dispute.created","charge.dispute.closed","radar.early_fraud_warning.created"]
    },{idempotencyKey:"voxa-os-sandbox-webhook-v1"});
    values.STRIPE_WEBHOOK_SECRET = endpoint.secret;
    values.STRIPE_WEBHOOK_ENDPOINT_ID = endpoint.id;
    if (!endpoint.secret || endpoint.livemode) throw new Error("Webhook secret unavailable");
  }
  saveEnv(".env.staging.local",values);
  console.log("PASS: EUR 19.99/month catalog, portal and signed webhook configured in sandbox; secrets saved only in ignored staging environment.");
  console.log("Stripe Tax collection remains disabled. No live resources or tax registrations were created.");
} catch (error) {
  console.error(`Sandbox setup failed at ${phase} (${error.type ?? error.name}); ${error.type ? "Stripe response suppressed" : error.message}.`);
  process.exitCode = 1;
}
