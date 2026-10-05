"use client";
import { T, LocalizedElement } from "@/components/locale-provider";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { enrollMfa, verifyMfa, disableMfa, type MfaState } from "./mfa-actions";

function Feedback({ state }: { state: MfaState }) {
  return state.error ? <p className="message error" role="alert"><T>{state.error}</T></p> : null;
}
export function MfaChallengeForm({ factorId, next }: { factorId: string; next: string }) {
  const [state, action, pending] = useActionState(verifyMfa, {});
  return <form action={action} className="form-stack">
    <fieldset disabled={pending} className="form-stack">
      <input type="hidden" name="factor_id" value={factorId}/><input type="hidden" name="next" value={next}/>
      <Field label="Cod de verificare"><Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus/></Field>
      <Feedback state={state}/><Button type="submit"><T>{pending ? "Se verifică…" : "Verifică codul"}</T></Button>
    </fieldset>
  </form>;
}
export function MfaEnrollmentForm() {
  const [state, action, pending] = useActionState(enrollMfa, {});
  return <div className="form-stack">
    <Feedback state={state}/>
    {state.enrollment ? <>
      <p><T>{"Scanați codul QR cu aplicația de autentificare de pe telefon. Păstrați cheia de configurare într-un manager de parole privat pentru a putea configura un alt dispozitiv."}</T></p>
      {/* This is a trusted Auth-provider data image; it contains the secret and is never persisted by the app. */}
      <LocalizedElement as="img" className="mfa-qr" src={state.enrollment.qrCode} alt="Cod QR pentru aplicația de autentificare" width={240} height={240}/>
      <Field label="Cheie de configurare"><Input readOnly value={state.enrollment.secret} autoComplete="off" spellCheck={false}/></Field>
      <p className="muted"><T>{"Verificarea în doi pași devine activă după confirmarea primului cod."}</T></p>
      <MfaChallengeForm factorId={state.enrollment.id} next="/account/security"/>
    </> : <form action={action}><Button type="submit" disabled={pending}><T>{pending ? "Se pregătește…" : "Configurează aplicația"}</T></Button></form>}
  </div>;
}
export function MfaDisableForm({ factorId }: { factorId: string }) {
  const [state, action, pending] = useActionState(disableMfa, {});
  return <form action={action} className="form-stack"><fieldset disabled={pending} className="form-stack">
    <input type="hidden" name="factor_id" value={factorId}/>
    <label><input type="checkbox" name="confirm" required/><T>{" Confirm dezactivarea verificării în doi pași pentru contul meu."}</T></label>
    <Feedback state={state}/><Button type="submit" variant="outline"><T>{"Dezactivează verificarea"}</T></Button>
  </fieldset></form>;
}
