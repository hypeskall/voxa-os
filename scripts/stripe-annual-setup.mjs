import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { readEnv, stagingEnv } from "./staging-env.mjs";
import { STRIPE_API_VERSION, assertMonthlyPrice, assertSubscriptionPrice } from "../src/features/subscriptions/stripe-model.ts";

// Configures a catalogue price only: never creates a charge or subscription.
const mode = process.argv[2];
const staging = process.argv[3] === "staging";
const file = staging ? ".env.staging.local" : ".env.stripe-live.local";
const settings = staging ? stagingEnv().env : readEnv(file);
const production = readEnv(".env.production.local");
const live = !staging;
if (!["check", "configure"].includes(mode)) throw Error("Use check or configure [staging].");
if (production.APP_ORIGIN !== "https://voxa-os.vercel.app" || production.NEXT_PUBLIC_SUPABASE_URL !== "https://fibcbsdattoqiyizzeda.supabase.co") throw Error("Unexpected production target.");
if (!(live ? /^[sr]k_live_/ : /^[sr]k_test_/).test(settings.STRIPE_SECRET_KEY ?? "")) throw Error("Wrong Stripe mode.");
const save = (target, priceId) => {
  const lines = fs.readFileSync(target, "utf8").split(/\r?\n/).filter(line => !line.startsWith("STRIPE_ANNUAL_PRICE_ID="));
  fs.writeFileSync(target, lines.join("\n").trimEnd() + `\nSTRIPE_ANNUAL_PRICE_ID=${priceId}\n`);
};
try {
  const stripe = new Stripe(settings.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20000 });
  const [account, balance, monthly] = await Promise.all([stripe.accounts.retrieve(null), stripe.balance.retrieve(), stripe.prices.retrieve(settings.STRIPE_PRICE_ID)]);
  if (account.id !== settings.STRIPE_ACCOUNT_ID || balance.livemode !== live || live && !account.charges_enabled) throw Error("Wrong account or payment capability.");
  assertMonthlyPrice(monthly, live);
  const lookup = `voxa_os_annual_eur_${live ? "live" : "sandbox"}`;
  let annual = settings.STRIPE_ANNUAL_PRICE_ID ? await stripe.prices.retrieve(settings.STRIPE_ANNUAL_PRICE_ID) : (await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 })).data[0];
  if (!annual && mode === "configure") {
    const product = await stripe.products.create({ name: "Voxa-OS Annual", description: "Voxa-OS · 149,99 EUR / year / organization", metadata: { app: "voxa-os", environment: staging ? "staging" : "production" } }, { idempotencyKey: `voxa-os-${lookup}-product-v1` });
    annual = await stripe.prices.create({ product: product.id, currency: "eur", unit_amount: 14999, recurring: { interval: "year" }, lookup_key: lookup, tax_behavior: "unspecified", metadata: { app: "voxa-os", billing_cycle: "annual" } }, { idempotencyKey: `voxa-os-${lookup}-price-v1` });
  }
  if (!annual) throw Error("Annual price is not configured.");
  assertSubscriptionPrice(annual, "annual", live);
  if (mode === "configure") {
    const auth = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, "com.vercel.cli/Data/auth.json"), "utf8"));
    const projectId = staging ? JSON.parse(fs.readFileSync(".staging-deploy/stripe-project.local.json", "utf8")).projectId : "prj_s89u9ys6auqD0nFhjIevV4PKgyjG";
    const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?slug=voxa6&upsert=true`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify([{ key: "STRIPE_ANNUAL_PRICE_ID", value: annual.id, type: "encrypted", target: [staging ? "preview" : "production"] }]), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Annual environment configuration failed (HTTP ${response.status}).`);
    save(file, annual.id);
    if (live) save(".env.production.local", annual.id);
  }
  console.log(`PASS: ${staging ? "sandbox" : "live"} annual price: EUR 149.99/year, account and monthly price verified. No customer charged.`);
} catch (error) {
  console.error(error instanceof Stripe.errors.StripeError ? "Stripe rejected annual configuration; provider diagnostics suppressed." : error.message);
  process.exitCode = 1;
}
