import type { Metadata } from "next";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { CookieNotice, CookieNoticeProvider } from "@/components/cookie-notice";
import { cookies } from "next/headers";
import { getLocale, getDictionary } from "@/lib/locale/server";
import { translateText } from "@/lib/locale/config";
import { SessionLock } from "@/features/auth/session-lock";
export const dynamic = "force-dynamic";
const siteMetadata: Metadata = {
  title: { default: "Voxa", template: "%s · Voxa" },
  description: "Spațiul de administrare al clinicii",
  robots: { index: false, follow: false },
};
export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary(await getLocale());
  return { ...siteMetadata, description: translateText(siteMetadata.description!, dictionary) };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dictionary = await getDictionary(locale);
  const noticeDismissed = (await cookies()).get("voxa-cookie-notice")?.value === "dismissed";
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body><LocaleProvider locale={locale} dictionary={dictionary}><CookieNoticeProvider dismissed={noticeDismissed}>{children}<CookieNotice /></CookieNoticeProvider><SessionLock /></LocaleProvider></body>
    </html>
  );
}
