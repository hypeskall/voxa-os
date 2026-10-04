import "server-only";
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "./stripe-model";

export function stripeConfigured() {
  return process.env.STRIPE_BILLING_ENABLED === "true" && process.env.APP_ENVIRONMENT === "staging" &&
    Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_ACCOUNT_ID && process.env.STRIPE_PORTAL_CONFIGURATION_ID);
}
export function stripeClient() {
  if (!stripeConfigured() || !/^[sr]k_test_/.test(process.env.STRIPE_SECRET_KEY ?? ""))
    throw new Error("Stripe sandbox is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20000 });
}
export async function verifiedStripe() {
  const stripe = stripeClient();
  const [account, balance] = await Promise.all([stripe.accounts.retrieve(null), stripe.balance.retrieve()]);
  if (account.id !== process.env.STRIPE_ACCOUNT_ID || balance.livemode) throw new Error("Stripe account mismatch");
  return stripe;
}
