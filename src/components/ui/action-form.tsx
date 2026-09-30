"use client";
import { useActionState } from "react";
import type { ActionState } from "@/features/auth/actions";
import { Button } from "./button";
export function ActionForm({
  action,
  children,
  submit = "Salvează modificările",
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="form-stack">
      <fieldset disabled={pending}>{children}</fieldset>
      {state.error && (
        <p className="message error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="message success" role="status">
          {state.success}
        </p>
      )}
      <div>
        <Button disabled={pending}>{pending ? "Se salvează…" : submit}</Button>
      </div>
    </form>
  );
}
