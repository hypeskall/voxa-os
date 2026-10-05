import type { Metadata } from "next";
import { renderMarketingPage } from "@/features/marketing/render-page";
import { getDictionary, getLocale } from "@/lib/locale/server";
import { translateText } from "@/lib/locale/config";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary(await getLocale());
  return { title: `${translateText("Funcționalități", dictionary)} · Voxa-OS`, robots: { index: true, follow: true } };
}

export default async function Page() {
  return renderMarketingPage("functionalitati");
}
