import type Stripe from "stripe";
import { adminDb } from "@/lib/supabase/admin";
import { stripeClient, stripeConfigured, stripeLiveMode, verifiedStripe } from "@/features/subscriptions/stripe-client";
import { STRIPE_EVENTS, objectId } from "@/features/subscriptions/stripe-model";
import { billingLock, billingSave, reconcileBilling } from "@/features/subscriptions/stripe-service";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!stripeConfigured()) return Response.json({ error: "Billing unavailable" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature || Number(request.headers.get("content-length") ?? 0) > 1048576) return Response.json({ error: "Invalid request" }, { status: 400 });
  let event: Stripe.Event;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 1048576) throw new Error("Payload too large");
    event = stripeClient().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    if (event.livemode !== stripeLiveMode() || event.account) throw new Error("Unsupported account or mode");
  } catch { return Response.json({ error: "Invalid signature or event" }, { status: 400 }); }
  if (!(STRIPE_EVENTS as readonly string[]).includes(event.type)) return Response.json({ received: true });
  const object = event.data.object;
  let customer: string | null = null;
  try {
    if ("customer" in object) customer = objectId(object.customer);
    else if ("charge" in object) {
      const chargeId = objectId(object.charge);
      if (chargeId) customer = objectId((await stripeClient().charges.retrieve(chargeId)).customer);
    }
  } catch { return Response.json({ error: "Retry billing event" }, { status: 500 }); }
  if (!customer) return Response.json({ received: true });
  const { data, error } = await adminDb().from("organization_stripe_billing").select("organization_id").eq("customer_id", customer).maybeSingle();
  if (error) return Response.json({ error: "Retry billing event" }, { status: 500 });
  // Metadata alone never authorizes a tenant. Only server-created mappings do.
  if (!data) return Response.json({ received: true });
  let billing;
  try {
    const stripe = await verifiedStripe();
    billing = await billingLock(data.organization_id);
    await reconcileBilling(stripe, billing, event.id, event.type);
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Retry billing event" }, { status: 500 }); }
  finally { if (billing) await billingSave(billing, { release: true }).catch(() => {}); }
}
