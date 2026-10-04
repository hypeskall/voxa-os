"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { enrollMfa, verifyMfa, disableMfa, type MfaState } from "./mfa-actions";

function Feedback({ state }: { state: MfaState }) {
  return state.error ? <p className="message error" role="alert">{state.error}</p> : null;
}
export function MfaChallengeForm({ factorId, next }: { factorId: string; next: string }) {
  const [state, action, pending] = useActionState(verifyMfa, {});
  return <form action={action} className="form-stack">
    <fieldset disabled={pending} className="form-stack">
      <input type="hidden" name="factor_id" value={factorId}/><input type="hidden" name="next" value={next}/>
      <Field label="Cod de verificare"><Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus/></Field>
      <Feedback state={state}/><Button type="submit">{pending ? "Se verifică…" : "Verifică codul"}</Button>
    </fieldset>
  </form>;
}
export function MfaEnrollmentForm() {
  const [state, action, pending] = useActionState(enrollMfa, {});
  return <div className="form-stack">
    <Feedback state={state}/>
    {state.enrollment ? <>
      <p>Scanați codul QR cu aplicația de autentificare de pe telefon. Păstrați cheia de configurare într-un manager de parole privat pentru a putea configura un alt dispozitiv.</p>
      {/* This is a trusted Auth-provider data image; it contains the secret and is never persisted by the app. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mfa-qr" src={state.enrollment.qrCode} alt="Cod QR pentru aplicația de autentificare" width={240} height={240}/>
      <Field label="Cheie de configurare"><Input readOnly value={state.enrollment.secret} autoComplete="off" spellCheck={false}/></Field>
      <p className="muted">Verificarea în doi pași devine activă după confirmarea primului cod.</p>
      <MfaChallengeForm factorId={state.enrollment.id} next="/account/security"/>
    </> : <form action={action}><Button type="submit" disabled={pending}>{pending ? "Se pregătește…" : "Configurează aplicația"}</Button></form>}
  </div>;
}
export function MfaDisableForm({ factorId }: { factorId: string }) {
  const [state, action, pending] = useActionState(disableMfa, {});
  return <form action={action} className="form-stack"><fieldset disabled={pending} className="form-stack">
    <input type="hidden" name="factor_id" value={factorId}/>
    <label><input type="checkbox" name="confirm" required/> Confirm dezactivarea verificării în doi pași pentru contul meu.</label>
    <Feedback state={state}/><Button type="submit" variant="outline">Dezactivează verificarea</Button>
  </fieldset></form>;
}
