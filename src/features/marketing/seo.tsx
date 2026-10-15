import type { Metadata } from "next";
import { marketingOrigin, indexableMarketing } from "./site-origin";
import { getDictionary, getLocale } from "@/lib/locale/server";
import { translateText } from "@/lib/locale/config";

export const publicPages = {
  "solutii-custom": {
    path: "/solutii-custom",
    title: "Voxa Custom — Soluții personalizate pentru clinici",
    description: "Ai nevoie de o soluție digitală pentru clinica ta? Discută cu Voxa despre programări, automatizări, portaluri și integrări personalizate.",
  },
  "alegere-software-clinica": {
    path: "/ghid/alegere-software-clinica",
    title: "Cum alegi un software pentru clinică | Voxa-OS",
    description: "Checklist pentru evaluarea unui software de clinică: programări, import, roluri, costuri și export. Scenarii de verificat cu date fictive înainte de alegere.",
  },
  home: {
    path: "",
    title: "Software pentru clinici medicale | Voxa-OS",
    description:
      "Programări, pacienți și echipă într-un singur software pentru clinici. Vezi Voxa-OS în pre-lansare, cu date fictive. Testare fără card.",
  },
  produs: {
    path: "/produs",
    title: "Software de administrare a clinicii | Voxa-OS",
    description:
      "Vezi interfața Voxa-OS: calendar, profil pacient, documente și echipă. Capturi reale din produs, cu date demonstrative.",
  },
  functionalitati: {
    path: "/functionalitati",
    title: "Programări, pacienți și portal medical | Voxa-OS",
    description:
      "Explorează programările medicale, registrul pacienților, portalul și accesul pe roluri. Vezi funcțiile și limitele Voxa-OS.",
  },
  "cum-functioneaza": {
    path: "/cum-functioneaza",
    title: "Cum configurezi clinica în Voxa-OS",
    description:
      "Configurează locațiile, medicii și serviciile, invită echipa și testează prima programare. Pași pentru evaluarea Voxa-OS.",
  },
  pret: {
    path: "/pret",
    title: "Preț software pentru clinici: 19,99 EUR | Voxa-OS",
    description:
      "Voxa-OS: 19,99 EUR/lună sau 149,99 EUR/an, pentru organizație. 30 de zile de testare, fără card și fără conversie automată.",
  },
  faq: {
    path: "/faq",
    title: "Întrebări despre software-ul pentru clinici | Voxa-OS",
    description:
      "Răspunsuri despre testare, abonament, WhatsApp, importul pacienților, portal și protecția datelor în Voxa-OS.",
  },
  prezentare: {
    path: "/prezentare",
    title: "Demo software pentru clinici medicale | Voxa-OS",
    description:
      "Explorează capturi din calendar, programări și profilul pacientului. Demonstrație Voxa-OS cu date fictive, fără cont.",
  },
  integrari: {
    path: "/integrari",
    title: "WhatsApp, Stripe și serviciile Voxa-OS",
    description:
      "Ce fac WhatsApp, Stripe, Supabase și Vercel în Voxa-OS. Funcții disponibile, limite și linkuri către documentația oficială.",
  },
  securitate: {
    path: "/securitate",
    title: "Acces și protecția datelor clinicii | Voxa-OS",
    description:
      "Cum gestionează Voxa-OS rolurile, autentificarea în doi pași, documentele private și accesul pacientului. Condiții de pre-lansare.",
  },
  migrare: {
    path: "/migrare",
    title: "Import pacienți din Excel sau CSV | Voxa-OS",
    description:
      "Importă pacienți din CSV sau Excel: model, câmpuri, validare și duplicate. Ghid Voxa-OS cu limita de 500 de rânduri per fișier.",
  },
} as const;
export type PublicPage = keyof typeof publicPages;

export async function marketingMetadata(page: PublicPage): Promise<Metadata> {
  const content = publicPages[page];
  const locale = await getLocale();
  const dictionary = await getDictionary(locale);
  const title = translateText(content.title, dictionary);
  const description = translateText(content.description, dictionary);
  const url = `${marketingOrigin()}${content.path || "/"}`;
  const image = {
    url: `${marketingOrigin()}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: "Voxa-OS — software pentru clinici medicale, în pre-lansare",
  };
  return {
    title: { absolute: title },
    description,
    robots: {
      index: indexableMarketing(),
      follow: indexableMarketing(),
      "max-image-preview": "large",
    },
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Voxa-OS",
      type: "website",
      locale: { ro: "ro_RO", en: "en_US", de: "de_DE", es: "es_ES", fr: "fr_FR", it: "it_IT", pl: "pl_PL" }[locale],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function MarketingSchema({ page }: { page: PublicPage }) {
  const origin = marketingOrigin();
  const content = publicPages[page];
  const url = `${origin}${content.path || "/"}`;
  const graph: object[] = [
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      name: "Voxa-OS",
      url: `${origin}/`,
      inLanguage: "ro",
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: content.title,
      description: content.description,
      inLanguage: "ro",
      isPartOf: { "@id": `${origin}/#website` },
    },
  ];
  if (page === "home")
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${origin}/#software`,
      name: "Voxa-OS",
      url: `${origin}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web browser",
      description:
        "Software pentru administrarea clinicilor medicale, în pre-lansare. Evaluare cu date fictive: programări, pacienți, echipă și documente.",
      featureList: [
        "Programări medicale",
        "Registru pacienți",
        "Portalul pacientului",
        "Permisiuni pe roluri",
        "Import CSV și Excel",
      ],
    });
  else
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Voxa-OS",
          item: `${origin}/`,
        },
        { "@type": "ListItem", position: 2, name: content.title, item: url },
      ],
    });
  // No invented company, ratings, customers or commercial offers before launch.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
