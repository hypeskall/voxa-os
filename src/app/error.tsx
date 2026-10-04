"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export default function ErrorPage({ reset, error }: { reset: () => void; error: Error & { digest?: string } }) {
  return (
    <main className="standalone">
      <p className="eyebrow">VOXA</p>
      <h1>Datele nu au putut fi încărcate</h1>
      <p className="muted mb-6">
        Conexiunea cu spațiul de lucru nu este disponibilă. Reîncercați; dacă
        problema persistă, contactați administratorul.
      </p>
      <Button onClick={reset}>Reîncearcă</Button>
      {error.digest && /^\d{1,30}$/.test(error.digest) && <p className="muted">Referință pentru suport: {error.digest}</p>}
      <p className="auth-note"><Link className="text-link" href="/login?switch=1">Schimbă contul sau deconectează-te</Link></p>
      <p className="auth-note"><Link className="text-link" href="/">Înapoi la pagina principală</Link></p>
    </main>
  );
}
