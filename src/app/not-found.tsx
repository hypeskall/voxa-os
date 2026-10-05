import { T } from "@/components/locale-provider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="standalone">
      <p className="eyebrow"><T>{"VOXA · ACCES"}</T></p>
      <h1><T>{"Pagina nu este disponibilă"}</T></h1>
      <p className="muted mb-6"><T>{"Locația sau pagina nu există ori contul dumneavoastră nu are acces."}</T></p>
      <Button asChild>
        <Link href="/dashboard"><T>{"Înapoi la spațiul de lucru"}</T></Link>
      </Button>
    </main>
  );
}
