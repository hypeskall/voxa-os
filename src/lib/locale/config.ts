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
  if (isLocale(saved)) return saved;
  const preferred = accepted.split(",").map((item, order) => {
    const [tag, quality] = item.trim().split(";");
    return { code: tag.toLowerCase().split("-")[0], quality: quality?.startsWith("q=") ? Number(quality.slice(2)) : 1, order };
  }).filter(item => item.quality > 0).sort((a, b) => b.quality - a.quality || a.order - b.order);
  return preferred.find(item => isLocale(item.code))?.code as Locale ?? "ro";
}
export function translateText(text: string, dictionary: Record<string, string>) {
  const key = text.replace(/\s+/g, " ").trim();
  const translated = dictionary[key];
  if (!translated) return text;
  return `${/^\s/.test(text) ? " " : ""}${translated}${/\s$/.test(text) ? " " : ""}`;
}
