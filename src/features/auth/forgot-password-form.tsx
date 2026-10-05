"use client";
import { T } from "@/components/locale-provider";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { forgotPassword } from "./account-actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, {});
  const started = useRef(false);
  useEffect(() => { started.current = false; }, [state]);
  const submitted = Boolean(state.success);
  return <form action={action} className="form-stack" onSubmit={event => {
    if (started.current || pending || submitted) event.preventDefault();
    else started.current = true;
  }}>
    <fieldset disabled={pending || submitted}>
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required maxLength={254}/></Field>
    </fieldset>
    {state.error && <p className="message error" role="alert"><T>{state.error}</T></p>}
    {state.success && <p className="message success" role="status"><T>{state.success}</T></p>}
    <p className="muted"><T>{"Folosiți linkul din cel mai recent email. O nouă solicitare îl înlocuiește pe cel anterior."}</T></p>
    <div><Button disabled={pending || submitted}><T>{submitted ? "Link solicitat" : pending ? "Se trimite…" : "Trimite linkul"}</T></Button></div>
    {submitted && <p><a className="text-link" href="/forgot-password"><T>{"Solicită un nou link sau folosește altă adresă"}</T></a></p>}
  </form>;
}
