import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return resolveLocale(jar.get(LOCALE_COOKIE)?.value);
}
export async function getDictionary(locale: Locale): Promise<Record<string, string>> {
  if (locale === "ro") return {};
  const catalogues = {
    en: () => import("./messages/en.json"), de: () => import("./messages/de.json"),
    fr: () => import("./messages/fr.json"), es: () => import("./messages/es.json"),
    it: () => import("./messages/it.json"), pl: () => import("./messages/pl.json"),
  };
  return (await catalogues[locale]()).default;
}
