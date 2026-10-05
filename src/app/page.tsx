import type { Metadata } from "next";
import { renderMarketingPage } from "@/features/marketing/render-page";
import "./marketing.css";
import { getLocale, getDictionary } from "@/lib/locale/server";
import { translateText } from "@/lib/locale/config";
const pageMetadata: Metadata = {
  title: "Voxa-OS · Platforma de administrare pentru clinici",
  description:
    "Mai puțină administrare. Mai mult timp pentru pacienți. Voxa-OS conectează programările, pacienții și echipa clinicii. 30 de zile gratuit, apoi 19,99 EUR/lună sau 149,99 EUR/an.",
  robots: { index: true, follow: true },
};
export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary(await getLocale());
  const title = translateText(String(pageMetadata.title), dictionary);
  const description = translateText(pageMetadata.description!, dictionary);
  return {
    ...pageMetadata,
    title,
    description,
    openGraph: { title, description, siteName: "Voxa-OS", type: "website" },
    twitter: { card: "summary", title, description },
  };
}
export default async function Home() {
  return renderMarketingPage();
}
