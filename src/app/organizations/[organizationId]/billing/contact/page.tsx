import { T } from "@/components/locale-provider";
import Link from "next/link";
import { requireOrganization } from "@/features/organizations/access";
export const metadata = { title: "Solicită activarea" };
export default async function Contact({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { organization } = await requireOrganization(organizationId, true);
  const support = process.env.VOXA_SUPPORT_EMAIL;
  return (
    <section className="billing-card">
      <p className="eyebrow"><T>{"ACTIVARE ABONAMENT"}</T></p>
      <h1><T>{"Continuă cu Voxa-OS."}</T></h1>
      <p className="muted"><T>{"Abonamentul costă 19,99 EUR / lună sau 149,99 EUR / an. Echipa Voxa-OS vă poate furniza o licență după confirmarea plății."}</T></p>
      {support && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) ? (
        <p className="billing-contact">
          <a
            className="button button-primary"
            href={`mailto:${support}?subject=${encodeURIComponent(`Activare Voxa-OS · ${organization.name}`)}&body=${encodeURIComponent(`Doresc activarea abonamentului pentru organizația ${organization.name}.\nID: ${organizationId}`)}`}
          ><T>{"Contactează echipa Voxa-OS"}</T></a>
        </p>
      ) : (
        <p className="billing-alert"><T>{"Contactați reprezentantul Voxa-OS care v-a oferit accesul. Adresa de suport nu a fost configurată încă."}</T></p>
      )}
      <Link
        className="text-link"
        href={`/organizations/${organizationId}/billing`}
      ><T>{"Înapoi la abonament"}</T></Link>
    </section>
  );
}
