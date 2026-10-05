import { T, LocalizedElement } from "@/components/locale-provider";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./marketing-header";

export function MarketingFooter({
  authenticated,
  supportEmail,
}: {
  authenticated: boolean;
  supportEmail?: string;
}) {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container">
        <div className="marketing-footer-top">
          <div>
            <Brand />
            <p><T>{"Un spațiu de lucru pentru întreaga clinică."}</T></p>
          </div>
          <LocalizedElement as="nav" aria-label="Produs și cont">
            <Link href="/produs"><T>{"Produs"}</T></Link>
            <Link href="/pret"><T>{"Preț"}</T></Link>
            <Link href={authenticated ? "/dashboard" : "/login"}>
              <T>{authenticated ? "Platforma mea" : "Autentificare"}</T>
            </Link>
            <Link href={authenticated ? "/dashboard" : "/register"}>
              <T>{authenticated ? "Deschide platforma" : "Începe gratuit"}</T>
              <ArrowUpRight size={13} />
            </Link>
          </LocalizedElement>
        </div>
        <div className="marketing-footer-bottom">
          <span>© {new Date().getFullYear()}<T>{" Voxa-OS"}</T></span>
          <LocalizedElement as="nav" aria-label="Informații">
            <Link href="/help"><T>{"Ajutor"}</T></Link>
            {authenticated && <Link href="/login?switch=1"><T>{"Schimbă contul"}</T></Link>}
            <Link href="/legal/privacy"><T>{"Confidențialitate"}</T></Link>
            <Link href="/legal/terms"><T>{"Termeni"}</T></Link>
            <Link href="/legal/cookies"><T>{"Cookies"}</T></Link>
            <Link href="/legal/data-processing"><T>{"DPA"}</T></Link>
            <Link href="/legal/complaints"><T>{"Reclamații · ANPC"}</T></Link>
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`}><T>{"Contact"}</T></a>
            ) : (
              <Link href="/help"><T>{"Contact"}</T></Link>
            )}
          </LocalizedElement>
          <span><T>{"Creat pentru munca de zi cu zi."}</T></span>
        </div>
      </div>
    </footer>
  );
}
