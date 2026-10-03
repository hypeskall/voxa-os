import { redirect } from "next/navigation";
import { workspace } from "@/features/auth/access";
import { organizationsForUser } from "@/features/organizations/access";
import { requireSubscription } from "@/features/subscriptions/access";
export default async function Dashboard() {
  const { clinics, preferences } = await workspace();
  const clinic = clinics.find(c => c.id === preferences?.default_clinic_id) ?? clinics[0];
  const { organizations } = await organizationsForUser();
  const organization = organizations.find(o => o.id === clinic?.organization_id) ?? organizations[0];
  if (organization) await requireSubscription(organization.id);
  if (organization && !organization.onboarding_completed) redirect(`/onboarding?organization=${organization.id}`);
  redirect(clinic ? `/clinics/${clinic.id}` : "/onboarding");
}
