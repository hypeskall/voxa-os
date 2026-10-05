import type Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-09-30.endive" as const;
export const STRIPE_MONTHLY_AMOUNT = 1999;
export const STRIPE_ANNUAL_AMOUNT = 14999;
export type BillingCycle = "monthly" | "annual";
export type StripeBilling = {
  organization_id: string; customer_id: string | null; subscription_id: string | null;
  status: string | null; checkout_id: string | null; checkout_expires_at: string | null;
  checkout_attempt: string; checkout_trial_end: number | null; lease_token: string;
  license_active?: boolean; trial_ends_at?: string; updated_at: string;
};
export function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}
export function assertMonthlyPrice(price: Stripe.Price, livemode = false) {
  assertSubscriptionPrice(price, "monthly", livemode);
}
export function assertSubscriptionPrice(price: Stripe.Price, cycle: BillingCycle, livemode = false) {
  if (price.livemode !== livemode || !price.active || price.currency !== "eur" || price.unit_amount !== (cycle === "annual" ? STRIPE_ANNUAL_AMOUNT : STRIPE_MONTHLY_AMOUNT) ||
    price.recurring?.interval !== (cycle === "annual" ? "year" : "month") || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed")
    throw new Error("Invalid subscription price or mode");
}
export function subscriptionSnapshot(subscription: Stripe.Subscription, prices: string | { monthly: string; annual?: string }, organizationId: string, livemode = false) {
  const item = subscription.items.data[0];
  const configured = typeof prices === "string" ? { monthly: prices } : prices;
  const cycle: BillingCycle = item?.price.id === configured.annual ? "annual" : "monthly";
  const priceId = configured[cycle];
  const amount = cycle === "annual" ? STRIPE_ANNUAL_AMOUNT : STRIPE_MONTHLY_AMOUNT;
  if (!priceId || subscription.livemode !== livemode || subscription.metadata.organization_id !== organizationId ||
    subscription.metadata.app !== "voxa-os" || subscription.items.data.length !== 1 || !item ||
    item.price.id !== priceId || item.quantity !== 1) throw new Error("Subscription mismatch");
  assertSubscriptionPrice(item.price, cycle, livemode);
  const invoice = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
  const line = invoice?.lines.data.find(line => line.pricing?.price_details?.price === priceId &&
    line.parent?.subscription_item_details?.subscription_item === item.id && !line.parent.subscription_item_details.proration);
  const paid = subscription.status === "active" && !subscription.pause_collection && invoice?.status === "paid" &&
    invoice.livemode === livemode && objectId(invoice.customer) === objectId(subscription.customer) &&
    objectId(invoice.parent?.subscription_details?.subscription) === subscription.id &&
    invoice.currency === "eur" && invoice.amount_paid >= amount &&
    invoice.amount_remaining === 0 && line?.amount === amount && line.quantity === 1 &&
    line.period.start === item.current_period_start && line.period.end === item.current_period_end;
  const end = paid && line ? Math.min(line.period.end, subscription.cancel_at ?? line.period.end) : null;
  return {
    billing_cycle: cycle,
    customer_id: objectId(subscription.customer), subscription_id: subscription.id,
    stripe_status: subscription.status, paid: Boolean(paid && end && line && end > line.period.start),
    period_start: paid && line ? new Date(line.period.start * 1000).toISOString() : null,
    period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end || subscription.cancel_at !== null,
  };
}
export const STRIPE_EVENTS = [
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
  "customer.subscription.paused", "customer.subscription.resumed", "invoice.paid", "invoice.payment_failed",
  "invoice.payment_action_required", "invoice.finalization_failed",
  "charge.refunded", "charge.dispute.created", "charge.dispute.closed", "radar.early_fraud_warning.created",
] as const;
