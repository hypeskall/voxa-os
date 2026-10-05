"use client";
import { T, LocalizedElement } from "@/components/locale-provider";

import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const links = [
  ["#platforma", "Produs"],
  ["#functionalitati", "Funcționalități"],
  ["#cum-functioneaza", "Cum funcționează"],
  ["#pret", "Preț"],
  ["#intrebari", "FAQ"],
];

export function Brand() {
  return (
    <Link
      href="/"
      className="marketing-brand"
      aria-label="Voxa-OS — pagina principală"
    >
      <span className="marketing-brand-mark"><T>{"V"}</T></span>
      <span><T>{"VOXA"}</T><span className="marketing-os"><T>{"-OS"}</T></span>
      </span>
    </Link>
  );
}

export function MarketingHeader({ authenticated }: { authenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) =>
      setScrolled(!entry.isIntersecting),
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 1101px)");
    const close = () => dialog.current?.close();
    breakpoint.addEventListener("change", close);
    return () => breakpoint.removeEventListener("change", close);
  }, []);
  const destination = authenticated ? "/dashboard" : "/register";
  return (
    <>
      <div
        className="marketing-scroll-sentinel"
        ref={sentinel}
        aria-hidden="true"
      />
      <header className={`marketing-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="marketing-container marketing-nav">
          <Brand />
          <LocalizedElement as="nav" className="marketing-desktop-nav" aria-label="Navigație website">
            {links.map(([href, label]) => (
              <a key={href} href={href}>
                <T>{label}</T>
              </a>
            ))}
          </LocalizedElement>
          <div className="marketing-nav-actions">
            <Link
              className="marketing-login"
              href={authenticated ? "/dashboard" : "/login"}
            >
              <T>{authenticated ? "Platforma mea" : "Autentificare"}</T>
              <ArrowUpRight size={14} />
            </Link>
            <Link
              className="marketing-button is-primary is-small"
              href={destination}
            >
              <T>{authenticated ? "Dashboard" : "Începe gratuit"}</T>
            </Link>
            <LocalizedElement as="button"
              className="marketing-menu-toggle"
              type="button"
              aria-label="Deschide meniul"
              aria-haspopup="dialog"
              onClick={() => dialog.current?.showModal()}
            >
              <Menu size={21} />
            </LocalizedElement>
          </div>
        </div>
        <dialog
          ref={dialog}
          className="marketing-mobile-menu"
          aria-labelledby="mobile-menu-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          <div className="marketing-mobile-menu-head">
            <span id="mobile-menu-title"><T>{"Voxa-OS"}</T></span>
            <LocalizedElement as="button"
              type="button"
              aria-label="Închide meniul"
              onClick={() => dialog.current?.close()}
            >
              <X size={22} />
            </LocalizedElement>
          </div>
          <LocalizedElement as="nav" aria-label="Navigație mobilă">
            {links.map(([href, label], index) => (
              <a key={href} href={href} onClick={() => dialog.current?.close()}>
                <span aria-hidden="true">0{index + 1}</span>
                <T>{label}</T>
                <ArrowUpRight size={20} />
              </a>
            ))}
          </LocalizedElement>
          <Link
            href={authenticated ? "/dashboard" : "/login"}
            onClick={() => dialog.current?.close()}
            className="marketing-button is-secondary"
          >
            <T>{authenticated ? "Platforma mea" : "Autentificare"}</T>
            <ArrowUpRight size={16} />
          </Link>
          {authenticated && <Link href="/login?switch=1" onClick={() => dialog.current?.close()} className="marketing-text-link"><T>{"Schimbă contul"}</T></Link>}
          <p><T>{"30 de zile gratuit. Apoi 19,99 EUR / lună sau 149,99 EUR / an."}</T></p>
        </dialog>
      </header>
    </>
  );
}
