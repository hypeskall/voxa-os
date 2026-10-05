"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { T } from "@/components/locale-provider";
import { MONTHLY_PRICE, ANNUAL_PRICE } from "@/features/subscriptions/model";

export function MarketingPrice({ authenticated }: { authenticated: boolean }) {
  const [annual, setAnnual] = useState(false);
  return (
    <section
      id="pret"
      className="premium-pricing marketing-section"
      aria-labelledby="home-pricing-title"
    >
      <div className="marketing-container">
        <div className="premium-centered-heading" data-reveal>
          <span className="marketing-eyebrow">
            <T>{"SIMPLU, INCLUSIV LA PREȚ"}</T>
          </span>
          <h2 id="home-pricing-title">
            <T>{"Un plan. Toată clinica."}</T>
          </h2>
          <p>
            <T>
              {
                "Începe cu 30 de zile gratuit. Descoperă produsul în ritmul echipei tale."
              }
            </T>
          </p>
        </div>
        <div className="premium-price-panel" data-reveal>
          <div className="premium-price-inclusions">
            <span className="price-brand">
              Voxa<span>-OS</span>
            </span>
            <p>
              <T>{"Un spațiu de lucru complet pentru organizația ta."}</T>
            </p>
            <ul>
              {[
                "Calendar și programări",
                "Pacienți, documente și rezultate",
                "Medici, servicii și resurse",
                "Locații și echipă",
                "Permisiuni pe roluri",
                "Portalul pacientului",
              ].map((item) => (
                <li key={item}>
                  <Check size={16} />
                  <T>{item}</T>
                </li>
              ))}
            </ul>
            <span className="price-footnote">
              <T>
                {"Abonament pentru organizație, fără tarif per utilizator."}
              </T>
            </span>
          </div>
          <div className="premium-price-decision">
            <fieldset className="premium-billing-toggle">
              <legend className="sr-only">
                <T>{"Alege perioada de facturare"}</T>
              </legend>
              <label data-selected={!annual}>
                <input
                  type="radio"
                  name="marketing-billing-cycle"
                  checked={!annual}
                  onChange={() => setAnnual(false)}
                />
                <T>{"Lunar"}</T>
              </label>
              <label data-selected={annual}>
                <input
                  type="radio"
                  name="marketing-billing-cycle"
                  checked={annual}
                  onChange={() => setAnnual(true)}
                />
                <T>{"Anual"}</T>
                <span>−37,5%</span>
              </label>
            </fieldset>
            <p className="premium-price-amount">
              <strong>{annual ? ANNUAL_PRICE : MONTHLY_PRICE}</strong>
              <span>
                <T>{annual ? "/ an" : "/ lună"}</T>
              </span>
            </p>
            <p className="premium-price-detail">
              <T>
                {annual
                  ? "Plata anuală se achită integral. Economisești 89,89 EUR pe an."
                  : "Plată lunară. Poți anula reînnoirea din cont."}
              </T>
            </p>
            <Link
              href={authenticated ? "/dashboard" : "/register"}
              className="marketing-button is-primary"
            >
              <T>
                {authenticated
                  ? "Deschide platforma"
                  : "Începe testarea gratuită"}
              </T>
              <ArrowRight size={17} />
            </Link>
            <p className="premium-price-trial">
              <Check size={14} />
              <T>{"30 de zile gratuit · Fără card"}</T>
            </p>
            <p className="price-footnote">
              <T>
                {
                  "La finalul testării, alegi dacă activezi abonamentul. Fără trecere automată la un plan cu plată."
                }
              </T>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
