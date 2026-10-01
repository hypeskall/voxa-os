import { redirect } from "next/navigation";
import { workspace, requireUser } from "@/features/auth/access";
import { createOrganization } from "@/features/settings/actions";
import { logout } from "@/features/auth/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
export default async function Onboarding() {
  const { clinics } = await workspace();
  if (clinics[0]) redirect(`/clinics/${clinics[0].id}`);
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
        {count
          ? "Accesul la locație nu este activ"
          : "Configurarea organizației"}
      </h1>
      <p className="muted">
        Dacă faceți parte dintr-o clinică existentă, solicitați
        administratorului atribuirea accesului.
      </p>
      {!count && (
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
