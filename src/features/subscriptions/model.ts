export const MONTHLY_PRICE = "19,99 EUR";
export const ANNUAL_PRICE = "149,99 EUR";
export const TRIAL_DAYS = 30;
export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "canceled" | "expired" | "inactive";
export type Subscription = {
  id: string;
  organization_id: string;
  plan: string;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "annual";
  trial_started_at: string;
  trial_ends_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  ended_at: string | null;
  license_key_id: string | null;
  entitlement_source: "license" | "provider" | null;
  provider_reference: string | null;
  created_at: string;
  updated_at: string;
};
export const statusLabels: Record<SubscriptionStatus, string> = {
  trialing: "Perioadă de testare",
  active: "Activ",
  past_due: "Plată restantă",
  canceled: "Încheiat",
  expired: "Expirat",
  inactive: "Inactiv",
};
export const eventLabels: Record<string, string> = {
  stripe_subscription_updated: "Abonament Stripe actualizat",
  trial_started: "Testarea gratuită a început",
  trial_expired: "Testarea gratuită s-a încheiat",
  license_assigned: "Licență atribuită",
  license_revoked: "Licență revocată",
  subscription_activated: "Abonament activat",
  subscription_renewed: "Abonament reînnoit",
  subscription_expired: "Abonament expirat",
  subscription_canceled: "Abonament încheiat",
};
export function remainingTrialDays(endsAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 86_400_000));
}
export function billingDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ro-RO", {
        dateStyle: "long",
        timeZone: "Europe/Bucharest",
      }).format(new Date(value))
    : "—";
}
export function normalizeLicense(value: string) {
  return value.trim().toUpperCase();
}
export const LICENSE_PATTERN = /^VOXA(?:-[A-F0-9]{4}){8}$/;
