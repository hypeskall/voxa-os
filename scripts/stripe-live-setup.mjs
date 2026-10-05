import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Stripe from "stripe";
import { readEnv } from "./staging-env.mjs";
import { STRIPE_API_VERSION, STRIPE_EVENTS, assertMonthlyPrice } from "../src/features/subscriptions/stripe-model.ts";

const origin = "https://voxa-os.vercel.app";
const file = ".env.stripe-live.local";
export function validateLiveTarget(production, settings) {
  if (production.APP_ORIGIN !== origin || production.NEXT_PUBLIC_SUPABASE_URL !== "https://fibcbsdattoqiyizzeda.supabase.co")
    throw new Error("Live billing must target the existing Voxa production project.");
  if (!/^[sr]k_live_[A-Za-z0-9]+$/.test(settings.STRIPE_SECRET_KEY ?? ""))
    throw new Error("Save the live server API key in .env.stripe-live.local; never use a sandbox key.");
}
function save(values) {
  const names = Object.keys(values);
  const lines = fs.readFileSync(file,"utf8").split(/\r?\n/).filter(line => !names.some(name => line.startsWith(name+"=")));
  fs.writeFileSync(file, lines.join("\n").trimEnd()+"\n"+Object.entries(values).map(([name,value])=>`${name}=${value}`).join("\n")+"\n");
}
export async function setupLive(mode) {
  if (!["check","configure"].includes(mode)) throw new Error("Use check or configure.");
  const production = readEnv(".env.production.local");
  const settings = readEnv(file);
  validateLiveTarget(production,settings);
  const stripe = new Stripe(settings.STRIPE_SECRET_KEY,{apiVersion:STRIPE_API_VERSION,maxNetworkRetries:2,timeout:20000});
  const [account,balance] = await Promise.all([stripe.accounts.retrieve(null),stripe.balance.retrieve()]);
  if (!balance.livemode || (settings.STRIPE_ACCOUNT_ID && account.id !== settings.STRIPE_ACCOUNT_ID))
    throw new Error("The key does not belong to the intended live account.");
  if (!account.charges_enabled) throw new Error("Stripe has not enabled payments for this live account.");
  console.log("PASS: live server key, account and payment capability verified.");
  if (mode === "check") return;
  save({STRIPE_ACCOUNT_ID:account.id});
  const lookup = "voxa_os_monthly_eur_live";
  let price = settings.STRIPE_PRICE_ID ? await stripe.prices.retrieve(settings.STRIPE_PRICE_ID)
    : (await stripe.prices.list({lookup_keys:[lookup],active:true,limit:1})).data[0];
  if (!price) {
    const product = await stripe.products.create({name:"Voxa-OS Monthly",description:"Abonament pentru o organizație, cu toate locațiile sale",
      metadata:{app:"voxa-os",environment:"production"}},{idempotencyKey:"voxa-os-live-product-v1"});
    price = await stripe.prices.create({product:product.id,currency:"eur",unit_amount:1999,recurring:{interval:"month"},
      lookup_key:lookup,tax_behavior:"unspecified"},{idempotencyKey:"voxa-os-live-price-v1"});
  }
  assertMonthlyPrice(price,true);
  save({STRIPE_PRICE_ID:price.id});
  const configurations=await stripe.billingPortal.configurations.list({limit:100});
  if(configurations.has_more)throw new Error("Review the portal inventory before configuring live billing.");
  let portal=settings.STRIPE_PORTAL_CONFIGURATION_ID ? await stripe.billingPortal.configurations.retrieve(settings.STRIPE_PORTAL_CONFIGURATION_ID)
    : configurations.data.find(item=>item.active && item.metadata.app==="voxa-os" && item.metadata.environment==="production");
  if(!portal)portal=await stripe.billingPortal.configurations.create({metadata:{app:"voxa-os",environment:"production"},
    default_return_url:`${origin}/dashboard`,features:{customer_update:{enabled:true,allowed_updates:["name","email","address","tax_id"]},
      invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:"at_period_end"},subscription_update:{enabled:false}}},
    {idempotencyKey:"voxa-os-live-portal-v1"});
  if(!portal.livemode || !portal.active || portal.features.subscription_cancel.mode!=="at_period_end" || !portal.features.subscription_cancel.enabled
    || !portal.features.payment_method_update.enabled || !portal.features.invoice_history.enabled || portal.features.subscription_update.enabled)
    throw new Error("The live billing portal configuration differs from the single-plan integration.");
  save({STRIPE_PORTAL_CONFIGURATION_ID:portal.id});
  const url=`${origin}/api/stripe/webhook`;
  const endpoints=await stripe.webhookEndpoints.list({limit:100});
  if(endpoints.has_more)throw new Error("Review the webhook inventory before configuring live billing.");
  let endpoint=settings.STRIPE_WEBHOOK_ENDPOINT_ID ? await stripe.webhookEndpoints.retrieve(settings.STRIPE_WEBHOOK_ENDPOINT_ID)
    : endpoints.data.find(item=>item.url===url && item.livemode);
  if(endpoint && !settings.STRIPE_WEBHOOK_SECRET)
    throw new Error("An existing live endpoint needs its signing secret saved in .env.stripe-live.local; no duplicate endpoint was created.");
  if(!endpoint){
    endpoint=await stripe.webhookEndpoints.create({url,api_version:STRIPE_API_VERSION,enabled_events:[...STRIPE_EVENTS],
      description:"Voxa-OS production subscription billing",metadata:{app:"voxa-os",environment:"production"}},
      {idempotencyKey:"voxa-os-live-webhook-v1"});
    if(!endpoint.secret)throw new Error("The new endpoint signing secret was not returned.");
    save({STRIPE_WEBHOOK_SECRET:endpoint.secret});
  }
  if(!endpoint.livemode || endpoint.url!==url || endpoint.status!=="enabled" || endpoint.api_version!==STRIPE_API_VERSION
    || !STRIPE_EVENTS.every(event=>endpoint.enabled_events.includes(event) || endpoint.enabled_events.includes("*")))
    throw new Error("Live webhook target, mode, version or events differ from the integration.");
  save({STRIPE_WEBHOOK_ENDPOINT_ID:endpoint.id});
  console.log("PASS: live monthly price, portal and signed production endpoint configured. No customer charged; deployment activation is a separate step.");
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{await setupLive(process.argv[2]);}
  catch(error){console.error(error instanceof Stripe.errors.StripeError ? "Stripe rejected the live setup operation; private provider diagnostics suppressed." : error.message);process.exitCode=1;}
}
