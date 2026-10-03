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
      <p className="eyebrow">ACTIVARE ABONAMENT</p>
      <h1>Continuă cu Voxa-OS.</h1>
      <p className="muted">
        Abonamentul costă 19,99 EUR / lună. Echipa Voxa-OS vă poate furniza o
        licență după confirmarea plății.
      </p>
      {support && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) ? (
        <p className="billing-contact">
          <a
            className="button button-primary"
            href={`mailto:${support}?subject=${encodeURIComponent(`Activare Voxa-OS · ${organization.name}`)}&body=${encodeURIComponent(`Doresc activarea abonamentului pentru organizația ${organization.name}.\nID: ${organizationId}`)}`}
          >
            Contactează echipa Voxa-OS
          </a>
        </p>
      ) : (
        <p className="billing-alert">
          Contactați reprezentantul Voxa-OS care v-a oferit accesul. Adresa de
          suport nu a fost configurată încă.
        </p>
      )}
      <Link
        className="text-link"
        href={`/organizations/${organizationId}/billing`}
      >
        Înapoi la abonament
      </Link>
    </section>
  );
}
