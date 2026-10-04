import "server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { adminDb } from "@/lib/supabase/admin";
import { subscriptionSnapshot, objectId, type StripeBilling } from "./stripe-model";

export async function billingLock(organizationId: string) {
  const { data, error } = await adminDb().rpc("stripe_billing_lock", { oid: organizationId });
  if (error || !data) throw new Error("Billing unavailable");
  return data as unknown as StripeBilling;
}
export async function billingSave(billing: StripeBilling, payload: import("@/types/database").Json) {
  const { error } = await adminDb().rpc("stripe_billing_save", { oid: billing.organization_id, token: billing.lease_token, payload });
  if (error) throw new Error("Billing persistence failed");
}
export async function latestSubscription(stripe: Stripe, billing: StripeBilling) {
  if (!billing.customer_id) return null;
  const subscriptions = await stripe.subscriptions.list({ customer: billing.customer_id, status: "all", limit: 100 });
  if (subscriptions.has_more) throw new Error("Subscription reconciliation required");
  const matching = subscriptions.data.filter(s => s.metadata.app === "voxa-os" && s.metadata.organization_id === billing.organization_id);
  const pending = matching.filter(s => !["canceled", "incomplete_expired"].includes(s.status));
  if (pending.length > 1) throw new Error("Multiple subscriptions require review");
  const selected = pending[0] ?? matching.sort((a,b) => b.created-a.created)[0];
  return selected ? stripe.subscriptions.retrieve(selected.id, { expand: ["latest_invoice"] }) : null;
}
export async function reconcileBilling(stripe: Stripe, billing: StripeBilling, eventId = `sync_${randomUUID()}`, kind = "server_reconciliation") {
  const subscription = await latestSubscription(stripe, billing);
  if (!subscription) return null;
  const snapshot = subscriptionSnapshot(subscription, process.env.STRIPE_PRICE_ID!, billing.organization_id);
  // A paid invoice alone also includes payments recorded outside Stripe. Require
  // an actual successful, unrefunded Stripe charge before granting paid access.
  if (snapshot.paid && typeof subscription.latest_invoice === "object" && subscription.latest_invoice) {
    const payments = await stripe.invoicePayments.list({ invoice: subscription.latest_invoice.id, status: "paid", limit: 100 });
    if (payments.has_more) throw new Error("Invoice reconciliation required");
    let collected = 0;
    for (const payment of payments.data) {
      let charge: Stripe.Charge | null = null;
      const intentId = objectId(payment.payment.payment_intent);
      const chargeId = objectId(payment.payment.charge);
      if (intentId) {
        const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
        if (intent.status === "succeeded" && typeof intent.latest_charge === "object") charge = intent.latest_charge;
      } else if (chargeId) charge = await stripe.charges.retrieve(chargeId);
      if (charge && !charge.livemode && charge.paid && charge.captured && !charge.disputed &&
        !charge.refunded && charge.amount_refunded === 0 && charge.currency === "eur" &&
        objectId(charge.customer) === billing.customer_id && !payment.livemode && payment.currency === "eur") collected += payment.amount_paid ?? 0;
    }
    snapshot.paid = collected >= 1999;
  }
  const { error } = await adminDb().rpc("stripe_billing_apply", {
    oid: billing.organization_id, token: billing.lease_token, eid: eventId, kind, snapshot,
  });
  if (error) throw new Error("Billing synchronization failed");
  return subscription;
}
