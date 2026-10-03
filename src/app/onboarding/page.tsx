import { redirect } from "next/navigation";
import { workspace, requireUser } from "@/features/auth/access";
import { createOrganization } from "@/features/settings/actions";
import { logout } from "@/features/auth/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { organizationsForUser, requireOrganization } from "@/features/organizations/access";
import { draftSchema, defaultHours, type OnboardingDraft } from "@/features/onboarding/model";
import { SetupWizard } from "@/features/onboarding/wizard";
import { uploadOrganizationLogo } from "@/features/onboarding/actions";
import { requireSubscription } from "@/features/subscriptions/access";
export default async function Onboarding({ searchParams }: { searchParams: Promise<{ organization?: string }> }) {
  const { clinics } = await workspace();
  const { organizations, memberships } = await organizationsForUser();
  const search = await searchParams;
  const organization = search.organization ? organizations.find((o) => o.id === search.organization) : organizations.find((o) => !o.onboarding_completed) ?? organizations[0];
  if (search.organization && !organization) redirect("/onboarding");
  if (organization) await requireSubscription(organization.id);
  if (organization?.onboarding_completed) {
    const clinic = clinics.find((c) => c.organization_id === organization.id);
    if (clinic) redirect(`/clinics/${clinic.id}`);
  }
  if (organization && !organization.onboarding_completed && memberships.some((m) => m.organization_id === organization.id && m.role === "OWNER" && m.status === "active")) {
    const { client } = await requireOrganization(organization.id, true);
    const { data: saved, error } = await client.from("onboarding_drafts").select("step,payload,revision").eq("organization_id", organization.id).single();
    if (error) throw new Error("Configurarea salvată nu a putut fi încărcată.");
    const first = clinics.find((c) => c.organization_id === organization.id);
    if (!first) throw new Error("Locația inițială nu este disponibilă.");
    const parsed = draftSchema.safeParse(saved.payload);
    const initial: OnboardingDraft = parsed.success ? parsed.data : { clinic: { name: organization.name, legal_name: "", cui: "", phone: "", email: "", website: "", specialty: "" }, locations: [{ id: first.id, name: first.name, address: first.address, phone: first.phone, email: first.email, city: "", county: "", hours: defaultHours() }], services: [], doctors: [], rooms: [], team: [] };
    return <main className="setup-page"><header className="setup-header"><span className="brand">VOXA</span><form action={logout}><Button variant="ghost">Deconectare</Button></form></header><SetupWizard organizationId={organization.id} initial={initial} initialStep={saved.step} initialRevision={saved.revision}/><details className="setup-logo"><summary>Logo clinică (opțional)</summary><ActionForm action={uploadOrganizationLogo.bind(null, organization.id)} submit="Încarcă logo-ul"><Field label="Imagine logo" hint="PNG, JPEG sau WebP, maximum 3 MB."><Input name="file" type="file" required accept="image/png,image/jpeg,image/webp"/></Field></ActionForm>{organization.logo_path && <p className="muted">Logo-ul clinicii este salvat.</p>}</details></main>;
  }
  const { client, user } = await requireUser();
  const { count, error } = await client
    .from("clinic_memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (error) throw new Error("Accesul nu a putut fi verificat.");
  return (
    <main className="standalone">
      <p className="eyebrow">VOXA</p>
      <h1>
        {count || memberships.length
          ? "Accesul la locație nu este activ"
          : "Configurarea organizației"}
      </h1>
      <p className="muted">
        Dacă faceți parte dintr-o clinică existentă, solicitați
        administratorului atribuirea accesului.
      </p>
      {!count && !memberships.length && (
        <section className="surface">
          <h2>Organizație nouă</h2>
          <ActionForm
            action={createOrganization}
            submit="Creează spațiul de lucru"
          >
            <Field label="Denumirea organizației">
              <Input name="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Prima locație">
              <Input name="clinicName" required minLength={2} maxLength={100} />
            </Field>
          </ActionForm>
        </section>
      )}
      <form action={logout} className="mt-6">
        <Button variant="outline">Deconectare</Button>
      </form>
    </main>
  );
}
