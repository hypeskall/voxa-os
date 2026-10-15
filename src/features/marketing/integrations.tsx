import Image from "next/image";
import Link from "next/link";
import { T } from "@/components/locale-provider";

export const integrations = [
  {
    name: "WhatsApp",
    logo: "/brands/whatsapp.svg",
    width: 131,
    height: 30,
    role: "Mesaje trimise manual",
    detail:
      "Deschizi conversația cu numărul pacientului și textul pregătit. Verifici mesajul și îl trimiți din WhatsApp. Deschiderea conversației nu confirmă livrarea mesajului.",
    url: "https://faq.whatsapp.com/5913398998672934",
  },
  {
    name: "Stripe",
    logo: "/brands/stripe.svg",
    width: 360,
    height: 150,
    role: "Abonamentul Voxa-OS",
    detail:
      "Checkout și administrarea reînnoirii abonamentului organizației. Această integrare privește plata pentru Voxa-OS, nu încasările clinicii de la pacienți.",
    url: "https://docs.stripe.com/billing/subscriptions/overview",
  },
  {
    name: "Supabase",
    logo: "/brands/supabase.svg",
    width: 581,
    height: 113,
    role: "Autentificare și date",
    detail:
      "Serviciile pentru conturi, baza de date și stocarea privată a documentelor. Accesul este verificat în raport cu organizația, clinica și rolul utilizatorului.",
    url: "https://supabase.com/docs/guides/database/postgres/row-level-security",
  },
  {
    name: "Vercel",
    logo: "/brands/vercel.svg",
    width: 2048,
    height: 407,
    role: "Găzduirea aplicației web",
    detail:
      "Infrastructura pe care rulează aplicația Voxa-OS în browser. Nu este un serviciu de programări sau un parteneriat clinic.",
    url: "https://vercel.com/docs",
  },
] as const;

export function IntegrationStrip() {
  return (
    <section
      className="marketing-integrations marketing-container"
      aria-labelledby="integrations-title"
    >
      <div className="integration-heading" data-reveal>
        <h2 id="integrations-title">
          <T>{"Servicii folosite de Voxa-OS"}</T>
        </h2>
        <Link href="/integrari" className="marketing-text-link">
          <T>{"Ce face fiecare integrare"}</T> →
        </Link>
      </div>
      <div className="integration-grid" data-stagger>
        {integrations.map((brand) => (
          <Link
            href={`/integrari#${brand.name.toLowerCase()}`}
            className="integration-card"
            data-reveal="scale"
            key={brand.name}
          >
            <span className="integration-logo">
              <Image
                src={brand.logo}
                width={brand.width}
                height={brand.height}
                alt={brand.name}
              />
            </span>
            <span>
              <T>{brand.role}</T>
            </span>
          </Link>
        ))}
      </div>
      <p className="integration-caption">
        <T>
          {
            "Logourile identifică serviciile utilizate. Nu reprezintă certificări sau recomandări ale Voxa-OS."
          }
        </T>
      </p>
    </section>
  );
}
