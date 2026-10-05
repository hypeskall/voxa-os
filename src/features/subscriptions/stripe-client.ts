import "server-only";
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "./stripe-model";

export function stripeBillingMode(): "sandbox" | "live" | null {
  if (process.env.APP_ENVIRONMENT === "staging" && (!process.env.STRIPE_BILLING_MODE || process.env.STRIPE_BILLING_MODE === "sandbox")) return "sandbox";
  if (process.env.APP_ENVIRONMENT === "production" && process.env.STRIPE_BILLING_MODE === "live" && process.env.VERCEL_ENV !== "preview") return "live";
  return null;
}
export function stripeLiveMode() {
  const mode = stripeBillingMode();
  if (!mode) throw new Error("Stripe billing environment mismatch");
  return mode === "live";
}
export function stripeConfigured() {
  const mode = stripeBillingMode();
  const prefix = mode === "live" ? /^[sr]k_live_/ : /^[sr]k_test_/;
  return Boolean(mode) && process.env.STRIPE_BILLING_ENABLED === "true" && prefix.test(process.env.STRIPE_SECRET_KEY ?? "") &&
    Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_ACCOUNT_ID && process.env.STRIPE_PORTAL_CONFIGURATION_ID);
}
export function stripeClient() {
  if (!stripeConfigured()) throw new Error("Stripe billing is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20000 });
}
export async function verifiedStripe() {
  const stripe = stripeClient();
  const [account, balance] = await Promise.all([stripe.accounts.retrieve(null), stripe.balance.retrieve()]);
  if (account.id !== process.env.STRIPE_ACCOUNT_ID || balance.livemode !== stripeLiveMode()) throw new Error("Stripe account mismatch");
  if (stripeLiveMode() && !account.charges_enabled) throw new Error("Stripe live account cannot accept payments");
  return stripe;
}
