export const languages = [
  { code: "ro", name: "Română" }, { code: "en", name: "English" },
  { code: "de", name: "Deutsch" }, { code: "fr", name: "Français" },
  { code: "es", name: "Español" }, { code: "it", name: "Italiano" },
  { code: "pl", name: "Polski" },
] as const;
export type Locale = typeof languages[number]["code"];
export const LOCALE_COOKIE = "voxa-locale";
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && languages.some(language => language.code === value);
}
export function resolveLocale(saved?: string, accepted = ""): Locale {
  // Browser preferences never override the Romanian default.
  void accepted;
  return isLocale(saved) ? saved : "ro";
}
export function translateText(text: string, dictionary: Record<string, string>) {
  const key = text.replace(/\s+/g, " ").trim();
  const translated = dictionary[key];
  if (!translated) return text;
  return `${/^\s/.test(text) ? " " : ""}${translated}${/\s$/.test(text) ? " " : ""}`;
}
