import Link from "next/link";
import { CreditCard, KeyRound, ArrowUpRight, ShieldCheck } from "lucide-react";
import { requireOrganization } from "@/features/organizations/access";
import { organizationEntitled } from "./access";
import { activateLicense } from "./actions";
import {
  billingDate,
  eventLabels,
  MONTHLY_PRICE,
  remainingTrialDays,
  statusLabels,
} from "./model";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";

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
          <p className="eyebrow">{organization.name} · ABONAMENT</p>
          <h1>Un plan. Toată clinica.</h1>
          <p className="muted">
            Gestionați accesul organizației și licența Voxa-OS.
          </p>
        </div>
        <Link className="button button-outline" href="/dashboard">
          Înapoi în platformă <ArrowUpRight size={16} />
        </Link>
      </header>
      {!entitled && (
        <div className="billing-alert" role="status">
          <ShieldCheck size={20} />
          <div>
            <strong>Accesul operațional este suspendat.</strong>
            <p>
              Datele clinicii sunt păstrate. Activați o licență pentru a
              continua.
            </p>
          </div>
        </div>
      )}
      <div className="billing-grid">
        <section className="billing-card">
          <div className="billing-card-title">
            <CreditCard size={21} />
            <h2>Voxa-OS Monthly</h2>
            <span className={`billing-status ${entitled ? "is-active" : ""}`}>
              {statusLabels[s.status]}
            </span>
          </div>
          <p className="billing-price">
            {MONTHLY_PRICE}
            <small> / lună</small>
          </p>
          <p className="muted">
            Un abonament pentru organizație, cu toate locațiile sale.
          </p>
          <dl className="billing-facts">
            <div>
              <dt>Perioada de testare</dt>
              <dd>
                {billingDate(s.trial_started_at)} –{" "}
                {billingDate(s.trial_ends_at)}
              </dd>
            </div>
            {s.status === "trialing" && (
              <div>
                <dt>Zile de testare rămase</dt>
                <dd>{remainingTrialDays(s.trial_ends_at)}</dd>
              </div>
            )}
            <div>
              <dt>Acces plătit până la</dt>
              <dd>{billingDate(s.current_period_end)}</dd>
            </div>
            <div>
              <dt>Licență</dt>
              <dd>
                {license?.data
                  ? `••••-${license.data.code_hint} · ${license.data.status === "active" ? "activă" : license.data.status === "revoked" ? "revocată" : "expirată"}`
                  : "Nicio licență activată"}
              </dd>
            </div>
            <div>
              <dt>Reînnoire</dt>
              <dd>
                {s.entitlement_source === "provider"
                  ? s.cancel_at_period_end
                    ? "Se încheie la finalul perioadei"
                    : "Prin furnizorul de plăți"
                  : "Prin activarea unei noi licențe"}
              </dd>
            </div>
          </dl>
          <p className="muted">
            Trialul este gratuit. Nu există debitare automată prin licență.
          </p>
        </section>
        <section className="billing-card" id="activation">
          <div className="billing-card-title">
            <KeyRound size={21} />
            <h2>Activează o licență</h2>
          </div>
          <p className="muted">
            Introduceți codul primit de la echipa Voxa-OS. Licența activează
            accesul tuturor locațiilor organizației.
          </p>
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
            <h3>Ai nevoie de un abonament?</h3>
            <p>
              Activarea este gestionată prin echipa Voxa-OS. Plata online nu
              este disponibilă încă.
            </p>
            <Link
              className="text-link"
              href={`/organizations/${organizationId}/billing/contact`}
            >
              Solicită activarea <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </div>
      <section className="billing-card billing-history">
        <h2>Istoricul abonamentului</h2>
        <ul>
          {events.data.map((event) => (
            <li key={event.id}>
              <span>
                {eventLabels[event.event_type] ?? "Actualizare abonament"}
              </span>
              <time dateTime={event.created_at}>
                {billingDate(event.created_at)}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
