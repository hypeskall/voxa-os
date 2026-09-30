import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="standalone">
      <p className="eyebrow">VOXA OS · ACCES</p>
      <h1>Pagina nu este disponibilă</h1>
      <p className="muted mb-6">
        Locația sau pagina nu există ori contul dumneavoastră nu are acces.
      </p>
      <Button asChild>
        <Link href="/">Înapoi la spațiul de lucru</Link>
      </Button>
    </main>
  );
}
