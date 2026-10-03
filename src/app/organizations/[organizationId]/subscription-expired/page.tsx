import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { requireOrganization } from "@/features/organizations/access";
import { organizationEntitled } from "@/features/subscriptions/access";
export const metadata = { title: "Abonament necesar" };
export default async function Expired({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { organization, membership } =
    await requireOrganization(organizationId);
  if (await organizationEntitled(organizationId)) redirect("/dashboard");
  return (
    <section className="subscription-lock">
      <div className="lock-icon">
        <LockKeyhole size={30} />
      </div>
      <p className="eyebrow">{organization.name} · VOXA-OS</p>
      <h1>Continuăm când ești pregătit.</h1>
      <p>
        Perioada de acces la platformă s-a încheiat. Pentru a continua să
        gestionați programările, pacienții și echipa, activați abonamentul
        organizației.
      </p>
      <div className="lock-price">
        <strong>19,99 EUR</strong>
        <span> / lună · toate funcționalitățile</span>
      </div>
      <p className="lock-data">
        <ShieldCheck size={17} />
        Datele clinicii sunt păstrate.
      </p>
      {membership.role === "OWNER" ? (
        <div className="marketing-actions">
          <Link
            className="button button-primary"
            href={`/organizations/${organizationId}/billing/contact`}
          >
            Activează abonamentul
          </Link>
          <Link
            className="button button-outline"
            href={`/organizations/${organizationId}/billing#activation`}
          >
            Introdu codul de licență
          </Link>
        </div>
      ) : (
        <p className="billing-alert">
          Contactați proprietarul organizației pentru reactivarea abonamentului.
        </p>
      )}
      <Link className="text-link" href="/">
        Vezi oferta Voxa-OS
      </Link>
    </section>
  );
}
