import type { Metadata } from "next";
import { renderMarketingPage } from "@/features/marketing/render-page";
import "./marketing.css";
import { getLocale, getDictionary } from "@/lib/locale/server";
import { translateText } from "@/lib/locale/config";
const pageMetadata: Metadata = {
  title: "Voxa-OS · Platforma de administrare pentru clinici",
  description:
    "Programări, pacienți, medici și locații într-o singură platformă. Încearcă Voxa-OS gratuit 30 de zile. Apoi 19,99 EUR pe lună sau 149,99 EUR pe an.",
  robots: { index: true, follow: true },
};
export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary(await getLocale());
  return { ...pageMetadata, title: translateText(String(pageMetadata.title), dictionary), description: translateText(pageMetadata.description!, dictionary) };
}
export default async function Home() {
  return renderMarketingPage();
}
