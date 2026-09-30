"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <p className="eyebrow">VOXA OS</p>
      <h1>Datele nu au putut fi încărcate</h1>
      <p className="muted mb-6">
        Conexiunea cu spațiul de lucru nu este disponibilă. Reîncercați; dacă
        problema persistă, contactați administratorul.
      </p>
      <Button onClick={reset}>Reîncearcă</Button>
    </main>
  );
}
