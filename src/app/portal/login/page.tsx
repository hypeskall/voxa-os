import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { requestPortalLink } from "@/features/patient-portal/actions";
export default function PortalLogin(){return <main className="portal-login"><section><p className="eyebrow">PORTAL PACIENT</p><h1>Accesați documentele medicale</h1><p className="muted">Veți primi pe email un link de autentificare cu utilizare sigură. Nu este necesară o parolă.</p><ActionForm action={requestPortalLink} submit="Trimite linkul securizat"><Field label="Adresa de email"><Input name="email" type="email" autoComplete="email" required/></Field></ActionForm></section></main>}
