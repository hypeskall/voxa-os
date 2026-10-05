import { T, LocaleDate, LocaleMessage } from "@/components/locale-provider";
import Link from "next/link";
import { CreditCard, KeyRound, ArrowUpRight, ShieldCheck } from "lucide-react";
import { requireOrganization } from "@/features/organizations/access";
import { organizationEntitled } from "./access";
import { activateLicense } from "./actions";
import {
  eventLabels,
  MONTHLY_PRICE,
  ANNUAL_PRICE,
  remainingTrialDays,
  statusLabels,
} from "./model";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { stripeConfigured, stripeBillingMode } from "./stripe-client";
import { startStripeCheckout, openStripePortal } from "./stripe-actions";

import { PlanPicker } from "./plan-picker";

export async function BillingPage({
  organizationId,
}: {
  organizationId: string;
}) {
  const { client, organization } = await requireOrganization(
    organizationId,
    true,
  );
  const entitled = await organizationEntitled(organizationId);
  const [subscription, events] = await Promise.all([
    client
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .single(),
    client
      .from("subscription_events")
      .select("id,event_type,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  if (subscription.error || events.error)
    throw new Error("Datele abonamentului nu au putut fi încărcate.");
  const s = subscription.data;
  const stripeEnabled = stripeConfigured();
  const stripeLive = stripeBillingMode() === "live";
  const billing = stripeEnabled ? await client.from("organization_stripe_billing")
    .select("customer_id,subscription_id,status").eq("organization_id", organizationId).maybeSingle() : null;
  if (billing?.error) throw new Error("Facturarea nu a putut fi verificată.");
  const license = s.license_key_id
    ? await client
        .from("license_keys")
        .select("code_hint,status,expires_at")
        .eq("id", s.license_key_id)
        .single()
    : null;
  if (license?.error) throw new Error("Licența nu a putut fi verificată.");
  return (
    <>
      <header className="billing-heading">
        <div>
          <p className="eyebrow">{organization.name}<T>{" · ABONAMENT"}</T></p>
          <h1><T>{"Un plan. Toată clinica."}</T></h1>
          <p className="muted"><T>{"Gestionați accesul organizației și licența Voxa-OS."}</T></p>
        </div>
        <Link className="button button-outline" href="/dashboard"><T>{"Înapoi în platformă "}</T><ArrowUpRight size={16} />
        </Link>
      </header>
      {!entitled && (
        <div className="billing-alert" role="status">
          <ShieldCheck size={20} />
          <div>
            <strong><T>{"Accesul operațional este suspendat."}</T></strong>
            <p><T>{"Datele clinicii sunt păstrate. Activați un abonament sau o licență pentru a continua."}</T></p>
          </div>
        </div>
      )}
      <div className="billing-grid">
        <section className="billing-card">
          <div className="billing-card-title">
            <CreditCard size={21} />
            <h2><T>{"Voxa-OS"}</T></h2>
            <span className={`billing-status ${entitled ? "is-active" : ""}`}>
              <T>{statusLabels[s.status]}</T>
            </span>
          </div>
          <p className="billing-price">
            <T>{s.billing_cycle === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE}</T>
            <small><T>{s.billing_cycle === "annual" ? " / an" : " / lună"}</T></small>
          </p>
          <p className="muted"><T>{"Un abonament pentru organizație, cu toate locațiile sale."}</T></p>
          <dl className="billing-facts">
            <div>
              <dt><T>{"Perioada de testare"}</T></dt>
              <dd>
                <LocaleDate value={s.trial_started_at} options={{ dateStyle: "long", timeZone: "Europe/Bucharest" }} /> –<T>{" "}</T>
                <LocaleDate value={s.trial_ends_at} options={{ dateStyle: "long", timeZone: "Europe/Bucharest" }} />
              </dd>
            </div>
            {s.status === "trialing" && (
              <div>
                <dt><T>{"Zile de testare rămase"}</T></dt>
                <dd>{remainingTrialDays(s.trial_ends_at)}</dd>
              </div>
            )}
            <div>
              <dt><T>{"Acces plătit până la"}</T></dt>
              <dd><LocaleDate value={s.current_period_end} options={{ dateStyle: "long", timeZone: "Europe/Bucharest" }} /></dd>
            </div>
            <div>
              <dt><T>{"Licență"}</T></dt>
              <dd>
                <T>{license?.data
                  ? <LocaleMessage template={"••••-{0} · {1}"} values={[license.data.code_hint,license.data.status === "active" ? "activă" : license.data.status === "revoked" ? "revocată" : "expirată"]} />
                  : "Nicio licență activată"}</T>
              </dd>
            </div>
            <div>
              <dt><T>{"Reînnoire"}</T></dt>
              <dd>
                <T>{s.entitlement_source === "provider"
                  ? s.cancel_at_period_end
                    ? "Se încheie la finalul perioadei"
                    : "Prin furnizorul de plăți"
                  : "Prin activarea unei noi licențe"}</T>
              </dd>
            </div>
          </dl>
          <p className="muted"><T>{"Trialul este gratuit. Nu există debitare automată prin licență."}</T></p>
          {stripeEnabled && <div className="billing-help">
            <h3><T>{stripeLive ? "Abonament online" : "Abonament online · test"}</T></h3>
            <p>{!stripeLive && "Folosiți numai date de test. Plata reală nu este activată. "}<T>{"Abonamentul se reînnoiește automat la 19,99 EUR/lună sau 149,99 EUR/an, în funcție de planul ales, pentru întreaga organizație după perioada gratuită rămasă. Anularea se face din portal, cu efect la finalul perioadei plătite."}</T>{!stripeLive && " Nu se colectează taxe în sandbox."}</p>
            {billing?.data?.customer_id && <form action={openStripePortal.bind(null, organizationId)}>
              <button className="button button-outline" type="submit"><T>{"Gestionează abonamentul și facturile"}</T></button>
            </form>}
            {!(s.entitlement_source === "license" && entitled) && !["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(billing?.data?.status ?? "") &&
              <ActionForm action={startStripeCheckout.bind(null, organizationId)} submit={stripeLive ? "Continuă la plată" : "Continuă la plata de test"}>
                <PlanPicker checkout />
                <label><input name="billing_consent" type="checkbox" required /><T>{" Confirm reînnoirea automată și posibilitatea de anulare din portalul de facturare."}</T></label>
              </ActionForm>}
            <p className="muted"><T>{"Confirmarea abonamentului poate dura câteva momente. Revenirea din pagina de plată nu acordă automat acces; reîncărcați pagina după confirmare."}</T></p>
          </div>}
        </section>
        <section className="billing-card" id="activation">
          <div className="billing-card-title">
            <KeyRound size={21} />
            <h2><T>{"Activează o licență"}</T></h2>
          </div>
          <p className="muted"><T>{"Introduceți codul primit de la echipa Voxa-OS. Licența activează accesul tuturor locațiilor organizației."}</T></p>
          <ActionForm
            action={activateLicense.bind(null, organizationId)}
            submit="Activează licența"
          >
            <Field label="Cod de licență">
              <Input
                name="license"
                required
                maxLength={44}
                placeholder="VOXA-XXXX-XXXX-…"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          </ActionForm>
          <div className="billing-help">
            <h3><T>{"Ai nevoie de un abonament?"}</T></h3>
            <p><T>{"Activarea prin licență este gestionată de echipa Voxa-OS."}</T><T>{stripeEnabled ? stripeLive ? " Puteți activa abonamentul și prin plata online." : " Plata online este disponibilă numai pentru testare." : " Plata online reală nu este activată."}</T>
            </p>
            <Link
              className="text-link"
              href={`/organizations/${organizationId}/billing/contact`}
            ><T>{"Solicită activarea "}</T><ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </div>
      <section className="billing-card billing-history">
        <h2><T>{"Istoricul abonamentului"}</T></h2>
        <ul>
          {events.data.map((event) => (
            <li key={event.id}>
              <span>
                <T>{eventLabels[event.event_type] ?? "Actualizare abonament"}</T>
              </span>
              <time dateTime={event.created_at}>
                <LocaleDate value={event.created_at} options={{ dateStyle: "long", timeZone: "Europe/Bucharest" }} />
              </time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
