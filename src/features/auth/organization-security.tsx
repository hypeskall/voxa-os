import Link from "next/link";
import { requireClinic } from "./access";
import { Section } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { T } from "@/components/locale-provider";
import { saveMfaPolicy } from "./security-actions";
export async function OrganizationSecurity({ cid }: { cid: string }) {
  const { client, clinic } = await requireClinic(cid, "organization.manage");
  const { data, error } = await client
    .from("organizations")
    .select("privileged_mfa_required")
    .eq("id", clinic.organization_id)
    .single();
  if (error) throw new Error("Politica organizației nu a putut fi citită.");
  return (
    <Section
      title="Securitatea organizației"
      description="Politica se aplică proprietarilor și administratorilor din toate locațiile organizației."
    >
      <p>
        <Link className="text-link" href="/account/security">
          <T>{"Configurează verificarea contului"}</T>
        </Link>
      </p>
      <ActionForm action={saveMfaPolicy.bind(null, cid)}>
        <label className="checkbox-line">
          <input
            name="required"
            type="checkbox"
            defaultChecked={data.privileged_mfa_required}
          />
          <T>
            {
              "Solicită autentificare în doi pași pentru proprietari și administratori"
            }
          </T>
        </label>
        <p className="muted">
          <T>
            {
              "Activați și verificați propriul factor înainte de a schimba politica. Colegii vor fi îndrumați să configureze verificarea la următorul acces."
            }
          </T>
        </p>
      </ActionForm>
    </Section>
  );
}
