import type { Metadata } from "next";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { CookieNotice } from "@/components/cookie-notice";
import { getLocale, getDictionary } from "@/lib/locale/server";
import { translateText } from "@/lib/locale/config";
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
  return (
    <html lang={locale}>
      <body><LocaleProvider locale={locale} dictionary={dictionary}>{children}<CookieNotice /></LocaleProvider></body>
    </html>
  );
}
