"use client";
import { T } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export default function ErrorPage({ retry, error }: { retry: () => void; error: Error & { digest?: string } }) {
  return (
    <main className="standalone">
      <p className="eyebrow"><T>{"VOXA"}</T></p>
      <h1><T>{"Datele nu au putut fi încărcate"}</T></h1>
      <p className="muted mb-6"><T>{"Conexiunea cu spațiul de lucru nu este disponibilă. Reîncercați; dacă problema persistă, contactați administratorul."}</T></p>
      <Button onClick={retry}><T>{"Reîncearcă"}</T></Button>
      {error.digest && /^\d{1,30}$/.test(error.digest) && <p className="muted"><T>{"Referință pentru suport: "}</T>{error.digest}</p>}
      <p className="auth-note"><Link className="text-link" href="/login?switch=1"><T>{"Schimbă contul sau deconectează-te"}</T></Link></p>
      <p className="auth-note"><Link className="text-link" href="/"><T>{"Înapoi la pagina principală"}</T></Link></p>
    </main>
  );
}
