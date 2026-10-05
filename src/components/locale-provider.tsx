"use client";
import { createContext, createElement, useContext, type ReactNode, type JSX, type HTMLAttributes, type ChangeEventHandler } from "react";
import { languages, LOCALE_COOKIE, translateText, isLocale, type Locale } from "@/lib/locale/config";

const LocaleContext = createContext<{ locale: Locale; dictionary: Record<string, string> }>({ locale: "ro", dictionary: {} });
export function LocaleProvider({ locale, dictionary, children }: { locale: Locale; dictionary: Record<string, string>; children: ReactNode }) {
  return <LocaleContext.Provider value={{ locale, dictionary }}>{children}<label className="language-selector">
    <span aria-hidden="true">🌐</span>
    <select aria-label="Language" value={locale} onChange={event => {
      const value = event.target.value;
      if (!isLocale(value)) return;
      document.cookie = `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      location.reload();
    }}>{languages.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.name}</option>)}</select>
  </label></LocaleContext.Provider>;
}
export function useLocale() {
  const { locale, dictionary } = useContext(LocaleContext);
  return { locale, t: (text: string) => translateText(text, dictionary) };
}
/** Only wrap application interface copy. Patient/clinic data must remain original. */
export function T({ children }: { children?: ReactNode }) {
  const { t } = useLocale();
  return typeof children === "string" ? t(children) : children;
}
export function LocaleDate({ value, options }: { value: string | null; options?: Intl.DateTimeFormatOptions }) {
  const { locale } = useLocale();
  return value ? new Intl.DateTimeFormat(locale, options).format(new Date(value)) : "—";
}
export function LocaleMessage({ template, values }: { template: string; values: unknown[] }) {
  const { t } = useLocale();
  return t(template).replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ""));
}
type LocalizedProps = Omit<HTMLAttributes<HTMLElement>, "onChange"> & {
  as: keyof JSX.IntrinsicElements;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  [key: string]: unknown;
};
export function LocalizedElement({ as, children, ...props }: LocalizedProps) {
  const { t } = useLocale();
  for (const key of ["placeholder", "title", "aria-label", "alt"]) if (typeof props[key] === "string") props[key] = t(props[key]);
  return createElement(as, props, children);
}
