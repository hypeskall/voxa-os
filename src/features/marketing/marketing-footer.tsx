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
            <Link href="/legal/privacy">Confidențialitate</Link>
            <Link href="/legal/terms">Termeni</Link>
            <Link href="/legal/cookies">Cookies</Link>
            <Link href="/legal/data-processing">DPA</Link>
            <Link href="/legal/complaints">Reclamații · ANPC</Link>
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`}>Contact</a>
            ) : (
              <Link href="/help">Contact</Link>
            )}
          </nav>
          <span>Creat pentru munca de zi cu zi.</span>
        </div>
      </div>
    </footer>
  );
}
