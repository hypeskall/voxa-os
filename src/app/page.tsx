import type { Metadata } from "next";
import { db } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { LandingPage } from "@/features/marketing/landing-page";
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
  let authenticated = false;
  if (hasSupabaseConfig()) {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    authenticated = Boolean(user);
  }
  const media = process.env.VOXA_DEMO_VIDEO_URL;
  const videoSrc =
    media &&
    (/^\/(?!\/)[\w/.-]+\.(mp4|webm)$/.test(media) ||
      /^https:\/\/[^\s]+\.(mp4|webm)(\?[^\s]*)?$/.test(media))
      ? media
      : undefined;
  const contact = process.env.VOXA_SUPPORT_EMAIL?.trim();
  const supportEmail =
    contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined;
  return (
    <LandingPage
      authenticated={authenticated}
      videoSrc={videoSrc}
      supportEmail={supportEmail}
    />
  );
}
