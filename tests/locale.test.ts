import { describe, it, expect } from "vitest";
import { resolveLocale, translateText } from "../src/lib/locale/config";
import en from "../src/lib/locale/messages/en.json";
import de from "../src/lib/locale/messages/de.json";
import fr from "../src/lib/locale/messages/fr.json";
import es from "../src/lib/locale/messages/es.json";
import itMessages from "../src/lib/locale/messages/it.json";
import pl from "../src/lib/locale/messages/pl.json";

describe("locale selection and interface catalogues", () => {
  it("defaults to Romanian regardless of browser preferences and honors saved choices", () => {
    expect(resolveLocale("fr", "de-DE")).toBe("fr");
    expect(resolveLocale("invalid", "en;q=0.2,de-DE;q=0.9")).toBe("ro");
    expect(resolveLocale(undefined, "pt;q=1,es;q=0.5")).toBe("ro");
    expect(resolveLocale(undefined, "en;q=0")).toBe("ro");
    expect(resolveLocale("../../private", "xx")).toBe("ro");
  });
  it("preserves unknown text and spacing without translating arbitrary clinical data", () => {
    expect(translateText("Ion Popescu", en)).toBe("Ion Popescu");
    expect(translateText(" Pacienți ", { Pacienți: "Patients" })).toBe(" Patients ");
  });
  it("ships every interface phrase in all six catalogues and preserves template variables", () => {
    const expected = Object.keys(en).sort();
    for (const dictionary of [de, fr, es, itMessages, pl]) {
      expect(Object.keys(dictionary).sort()).toEqual(expected);
      for (const [source, value] of Object.entries(dictionary)) {
        expect(value.trim()).not.toBe("");
        const variables = source.match(/\{\{[a-z_]+\}\}/g);
        if (variables) expect(value.match(/\{\{[a-z_]+\}\}/g)).toEqual(variables);
      }
    }
  });
});
