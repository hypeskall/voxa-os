"use client";

import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import { useRef, useState } from "react";
import { Brand } from "./marketing-header";

const information = {
  privacy: {
    title: "Confidențialitate",
    body: "Accesul la informațiile clinicii necesită autentificare și este controlat prin roluri. Înregistrările și fișierele sunt accesibile în contextul clinicii autorizate. Clinica stabilește scopurile utilizării datelor pacienților și gestionează solicitările privind acestea.",
    note: "Aceste informații descriu controalele produsului. Condițiile privind prelucrarea datelor trebuie stabilite cu operatorul platformei înainte de utilizarea cu date reale.",
  },
  terms: {
    title: "Condiții de utilizare",
    body: "Voxa-OS oferă 30 de zile de testare fără costuri. După această perioadă, abonamentul este de 19,99 EUR pe lună, pentru organizație. Activarea se face printr-o licență. Perioada de testare nu declanșează o plată automată.",
    note: "Condițiile contractuale și de facturare se stabilesc cu echipa Voxa-OS la activarea abonamentului.",
  },
  contact: {
    title: "Contact Voxa-OS",
    body: "Pentru activarea abonamentului sau informații despre licență, consultă pagina Abonament din contul organizației.",
    note: "Poți începe perioada de testare direct, fără o plată inițială.",
  },
};

export function MarketingFooter({
  authenticated,
  supportEmail,
}: {
  authenticated: boolean;
  supportEmail?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<keyof typeof information>("privacy");
  const content = information[selected];
  const show = (key: keyof typeof information) => {
    setSelected(key);
    dialog.current?.showModal();
  };
  return (
    <footer className="marketing-footer">
      <div className="marketing-container">
        <div className="marketing-footer-top">
          <div>
            <Brand />
            <p>Un spațiu de lucru pentru întreaga clinică.</p>
          </div>
          <nav aria-label="Produs și cont">
            <a href="#platforma">Produs</a>
            <a href="#pret">Preț</a>
            <Link href={authenticated ? "/dashboard" : "/login"}>
              {authenticated ? "Platforma mea" : "Autentificare"}
            </Link>
            <Link href={authenticated ? "/dashboard" : "/register"}>
              {authenticated ? "Deschide platforma" : "Începe gratuit"}
              <ArrowUpRight size={13} />
            </Link>
          </nav>
        </div>
        <div className="marketing-footer-bottom">
          <span>© {new Date().getFullYear()} Voxa-OS</span>
          <nav aria-label="Informații">
            <Link href="/help">Ajutor</Link>
            {authenticated && <Link href="/login?switch=1">Schimbă contul</Link>}
            <button type="button" onClick={() => show("privacy")}>
              Confidențialitate
            </button>
            <button type="button" onClick={() => show("terms")}>
              Termeni
            </button>
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`}>Contact</a>
            ) : (
              <button type="button" onClick={() => show("contact")}>
                Contact
              </button>
            )}
          </nav>
          <span>Creat pentru munca de zi cu zi.</span>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="marketing-info-dialog"
        aria-labelledby="marketing-info-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <button
          className="marketing-dialog-close"
          type="button"
          aria-label="Închide"
          onClick={() => dialog.current?.close()}
        >
          <X size={21} />
        </button>
        <span className="marketing-eyebrow">VOXA-OS / INFORMAȚII</span>
        <h2 id="marketing-info-title">{content.title}</h2>
        <p>{content.body}</p>
        <p className="marketing-info-note">{content.note}</p>
        {selected === "contact" && (
          <Link
            href={authenticated ? "/dashboard" : "/login"}
            className="marketing-button is-primary"
          >
            {authenticated ? "Deschide platforma" : "Autentificare"}
            <ArrowUpRight size={16} />
          </Link>
        )}
      </dialog>
    </footer>
  );
}
