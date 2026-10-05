"use client";

import { Check, ChevronDown, Globe2, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { languages, LOCALE_COOKIE, type Locale } from "@/lib/locale/config";

const menuLabels: Record<Locale, string> = {
  ro: "Limba interfeței", en: "Interface language", de: "Sprache der Oberfläche",
  fr: "Langue de l’interface", es: "Idioma de la interfaz", it: "Lingua dell’interfaccia",
  pl: "Język interfejsu",
};

export function LanguageSelector({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => languages.findIndex(language => language.code === locale));
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const search = useRef({ text: "", time: 0 });
  const listId = useId();
  const selected = pendingLocale ?? locale;
  const language = languages.find(language => language.code === selected)!;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function openMenu(index = languages.findIndex(language => language.code === locale)) {
    setActiveIndex(index);
    search.current = { text: "", time: 0 };
    setOpen(true);
  }

  function choose(value: Locale) {
    if (pendingLocale) return;
    trigger.current?.focus();
    if (value === locale) {
      setOpen(false);
      return;
    }
    setPendingLocale(value);
    document.cookie = `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      location.reload();
      return;
    }
    // Let the selection confirmation and menu exit finish before navigation.
    timers.current.push(window.setTimeout(() => setOpen(false), 170));
    timers.current.push(window.setTimeout(() => location.reload(), 330));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (pendingLocale) return;
    const count = languages.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openMenu();
      else setActiveIndex(index => (index + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      openMenu(event.key === "Home" ? 0 : count - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(languages[activeIndex].code);
      else openMenu();
    } else if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase();
      search.current = { text, time: now };
      const index = languages.findIndex(language => language.name.toLowerCase().startsWith(text));
      if (index >= 0) {
        event.preventDefault();
        setActiveIndex(index);
        setOpen(true);
      }
    }
  }

  return (
    <div ref={root} className="language-selector" data-open={open} data-changing={!!pendingLocale}>
      <button
        ref={trigger}
        type="button"
        className="language-selector-trigger"
        role="combobox"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${languages[activeIndex].code}` : undefined}
        aria-disabled={!!pendingLocale}
        onClick={() => { if (!pendingLocale) { if (open) setOpen(false); else openMenu(); } }}
        onKeyDown={handleKeyDown}
        onBlur={event => { if (!root.current?.contains(event.relatedTarget)) setOpen(false); }}
      >
        <span className="language-selector-icon" aria-hidden="true">
          {pendingLocale ? <LoaderCircle className="language-selector-loader" size={17} /> : <Globe2 size={17} strokeWidth={1.7} />}
        </span>
        <span key={selected} className="language-selector-name" lang={selected}>{language.name}</span>
        <ChevronDown className="language-selector-chevron" size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <div className="language-selector-menu" aria-hidden={!open} inert={!open}>
        <div className="language-selector-heading">{menuLabels[locale]}</div>
        <div id={listId} role="listbox" aria-label="Language">
          {languages.map((item, index) => (
            <button
              key={item.code}
              id={`${listId}-${item.code}`}
              type="button"
              role="option"
              aria-label={item.name}
              aria-selected={item.code === selected}
              tabIndex={-1}
              disabled={!!pendingLocale}
              className="language-selector-option"
              data-active={index === activeIndex}
              style={{ "--language-index": index } as CSSProperties}
              onPointerMove={event => { if (event.pointerType === "mouse" && !pendingLocale) setActiveIndex(index); }}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(item.code)}
            >
              <span className="language-selector-code" aria-hidden="true">{item.code.toUpperCase()}</span>
              <span lang={item.code}>{item.name}</span>
              {item.code === selected && <span className="language-selector-check" aria-hidden="true"><Check size={15} strokeWidth={2} /></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
