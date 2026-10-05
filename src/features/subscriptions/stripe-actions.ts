"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/features/organizations/access";
import type { ActionState } from "@/features/auth/actions";
import { appOrigin } from "@/lib/app-origin";
import { getLocale } from "@/lib/locale/server";
import { assertSubscriptionPrice, type BillingCycle, type StripeBilling } from "./stripe-model";
import { verifiedStripe, stripeLiveMode } from "./stripe-client";
import { billingLock, billingSave, latestSubscription, reconcileBilling } from "./stripe-service";

function safeStripeRedirect(value: string | null, portal = false) {
  const url = new URL(value ?? "");
  if (url.protocol !== "https:" || url.hostname !== (portal ? "billing.stripe.com" : "checkout.stripe.com")) throw new Error("Invalid billing destination");
  return url.href;
}
export async function startStripeCheckout(organizationId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { organization } = await requireOrganization(organizationId, true);
  if (form.get("billing_consent") !== "on") return { error: "Confirmați reînnoirea automată a abonamentului." };
  const selected = form.get("billing_cycle") ?? "monthly";
  if (selected !== "monthly" && selected !== "annual") return { error: "Alegeți un plan valid." };
  const cycle: BillingCycle = selected;
  let billing: StripeBilling | undefined;
  let destination: string | undefined;
  try {
    const stripe = await verifiedStripe();
    const priceId = cycle === "annual" ? process.env.STRIPE_ANNUAL_PRICE_ID : process.env.STRIPE_PRICE_ID;
    if (!priceId) throw new Error("Requested plan is not configured");
    const price = await stripe.prices.retrieve(priceId);
    const livemode = stripeLiveMode();
    assertSubscriptionPrice(price, cycle, livemode);
    billing = await billingLock(organizationId);
    if (billing.license_active) return { error: "Licența este încă activă. Păstrați accesul existent până la expirarea ei." };
    if (!billing.customer_id) {
      const customer = await stripe.customers.create({ name: organization.name, metadata: { organization_id: organizationId, app: "voxa-os" } },
        { idempotencyKey: `voxa-customer-${organizationId}` });
      if (customer.livemode !== livemode) throw new Error("Customer mode mismatch");
      await billingSave(billing, { customer_id: customer.id });
      billing.customer_id = customer.id;
    }
    const existing = await latestSubscription(stripe, billing);
    if (existing && !["canceled", "incomplete_expired"].includes(existing.status)) {
      await reconcileBilling(stripe, billing);
      return { error: "Există deja un abonament sau o plată în curs. Folosiți «Gestionează abonamentul» pentru actualizarea plății." };
    }
    if (!billing.checkout_id) {
      const sessions = await stripe.checkout.sessions.list({ customer: billing.customer_id, limit: 100 });
      if (sessions.has_more) throw new Error("Checkout reconciliation required");
      const recovered = sessions.data.find(s => s.metadata?.checkout_attempt === billing!.checkout_attempt);
      if (recovered) {
        await billingSave(billing, { checkout_id: recovered.id, checkout_expires_at: new Date(recovered.expires_at*1000).toISOString() });
        billing.checkout_id = recovered.id;
      }
    }
    if (billing.checkout_id) {
      const session = await stripe.checkout.sessions.retrieve(billing.checkout_id, { expand: ["line_items"] });
      const samePlan = session.line_items?.data.length === 1 && session.line_items.data[0].price?.id === price.id;
      if (session.status === "open" && !samePlan) {
        await stripe.checkout.sessions.expire(session.id);
        await billingSave(billing, { reset_checkout: true, release: true });
        billing = await billingLock(organizationId);
      } else
      if (session.status === "open" && session.url && session.expires_at > Date.now()/1000) destination = safeStripeRedirect(session.url);
      else if (session.status === "complete") {
        await reconcileBilling(stripe, billing);
        if (!existing || !["canceled", "incomplete_expired"].includes(existing.status)) return { error: "Plata este în curs de confirmare. Reîncărcați pagina sau folosiți portalul de facturare." };
        await billingSave(billing, { reset_checkout: true, release: true });
        billing = await billingLock(organizationId);
      } else {
        await billingSave(billing, { reset_checkout: true, release: true });
        billing = await billingLock(organizationId);
      }
    }
    if (!destination) {
      if (billing.trial_ends_at && Date.parse(billing.trial_ends_at)>Date.now() && (!billing.checkout_trial_end || billing.checkout_trial_end<Date.now()/1000+172800))
        return { error: "Testarea gratuită se încheie în mai puțin de două zile. Reveniți după expirare pentru a începe abonamentul fără a pierde zilele rămase." };
      if (billing.checkout_trial_end && billing.checkout_trial_end <= Date.now()/1000) {
        await billingSave(billing, { reset_checkout: true, release: true });
        billing = await billingLock(organizationId);
      }
      const base = `${appOrigin()}/organizations/${organizationId}/billing`;
      const session = await stripe.checkout.sessions.create({
        locale: await getLocale(),
        mode: "subscription", customer: billing.customer_id!, client_reference_id: organizationId,
        integration_identifier: "voxa_os_checkout_qmztxrpa",
        line_items: [{ price: price.id, quantity: 1 }], automatic_tax: { enabled: false },
        billing_address_collection: "required", tax_id_collection: { enabled: true },
        customer_update: { name: "auto", address: "auto" }, payment_method_collection: "always",
        metadata: { app: "voxa-os", organization_id: organizationId, checkout_attempt: billing.checkout_attempt, billing_cycle: cycle },
        subscription_data: { metadata: { app: "voxa-os", organization_id: organizationId, billing_cycle: cycle }, billing_mode: { type: "flexible" },
          ...(billing.checkout_trial_end ? { trial_end: billing.checkout_trial_end } : {}),
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } } },
        success_url: `${base}?checkout=received`, cancel_url: `${base}?checkout=canceled`,
      }, { idempotencyKey: `voxa-checkout-${billing.checkout_attempt}` });
      if (session.livemode !== livemode || session.customer !== billing.customer_id) throw new Error("Checkout mismatch");
      await billingSave(billing, { checkout_id: session.id, checkout_expires_at: new Date(session.expires_at*1000).toISOString() });
      destination = safeStripeRedirect(session.url);
    }
  } catch {
    return { error: "Facturarea nu este disponibilă momentan. Reîncercați; solicitarea nu activează accesul fără confirmarea plății." };
  } finally {
    if (billing) await billingSave(billing, { release: true }).catch(() => {});
  }
  redirect(destination!);
}
export async function openStripePortal(organizationId: string): Promise<void> {
  await requireOrganization(organizationId, true);
  let billing: StripeBilling | undefined;
  let destination: string;
  try {
    const stripe = await verifiedStripe();
    billing = await billingLock(organizationId);
    if (!billing.customer_id) throw new Error("No customer");
    await reconcileBilling(stripe, billing);
    const session = await stripe.billingPortal.sessions.create({ customer: billing.customer_id,
      locale: await getLocale(),
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
      return_url: `${appOrigin()}/organizations/${organizationId}/billing` });
    destination = safeStripeRedirect(session.url, true);
    revalidatePath(`/organizations/${organizationId}/billing`);
  } catch {
    throw new Error("Portalul de facturare nu este disponibil momentan. Reîncercați.");
  } finally {
    if (billing) await billingSave(billing, { release: true }).catch(() => {});
  }
  redirect(destination!);
}
