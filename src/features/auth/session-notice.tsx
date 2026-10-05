import { T } from "@/components/locale-provider";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { switchAccount } from "./actions";

export function SessionNotice({ destination = "/login", next = "/" }: { destination?: "/login" | "/register"; next?: string }) {
  return <div className="message" role="status">
    <p><T>{"Ai deja o sesiune conectată. Poți continua în platformă sau te poți deconecta pentru a folosi alt cont."}</T></p>
    <p><Link className="text-link" href="/dashboard"><T>{"Continuă în platformă"}</T></Link></p>
    <ActionForm action={switchAccount} submit={destination === "/register" ? "Deconectează-te și creează un cont" : "Deconectează-te și schimbă contul"}>
      <input type="hidden" name="destination" value={destination}/>
      <input type="hidden" name="next" value={next}/>
    </ActionForm>
  </div>;
}
