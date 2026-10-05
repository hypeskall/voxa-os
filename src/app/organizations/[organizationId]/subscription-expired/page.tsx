import { T } from "@/components/locale-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { requireOrganization } from "@/features/organizations/access";
import { organizationEntitled } from "@/features/subscriptions/access";
import { stripeConfigured } from "@/features/subscriptions/stripe-client";
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
      <p className="eyebrow">{organization.name}<T>{" · VOXA-OS"}</T></p>
      <h1><T>{"Continuăm când ești pregătit."}</T></h1>
      <p><T>{"Perioada de acces la platformă s-a încheiat. Pentru a continua să gestionați programările, pacienții și echipa, activați abonamentul organizației."}</T></p>
      <div className="lock-price">
        <strong><T>{"19,99 EUR"}</T></strong>
        <span><T>{" / lună · toate funcționalitățile"}</T></span>
      </div>
      <p className="lock-data">
        <ShieldCheck size={17} /><T>{"Datele clinicii sunt păstrate."}</T></p>
      {membership.role === "OWNER" ? (
        <div className="marketing-actions">
          <Link
            className="button button-primary"
            href={`/organizations/${organizationId}/billing${stripeConfigured() ? "" : "/contact"}`}
          ><T>{"Activează abonamentul"}</T></Link>
          <Link
            className="button button-outline"
            href={`/organizations/${organizationId}/billing#activation`}
          ><T>{"Introdu codul de licență"}</T></Link>
        </div>
      ) : (
        <p className="billing-alert"><T>{"Contactați proprietarul organizației pentru reactivarea abonamentului."}</T></p>
      )}
      <Link className="text-link" href="/"><T>{"Vezi oferta Voxa-OS"}</T></Link>
    </section>
  );
}
