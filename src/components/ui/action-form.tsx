"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/features/auth/actions";
import { Button } from "./button";
import { MAX_UPLOAD_BYTES } from "@/lib/medical-storage";
export function ActionForm({
  action,
  children,
  submit = "Salvează modificările",
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submit?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [uploadError, setUploadError] = useState("");
  return (
    <form action={formAction} className="form-stack" onSubmit={(e)=>{ const data=new FormData(e.currentTarget); const total=[...data.values()].reduce((sum,value)=>sum+(value instanceof File?value.size:0),0); if(total>MAX_UPLOAD_BYTES){e.preventDefault();setUploadError("Fișierele selectate pot avea împreună cel mult 3 MB.");}else setUploadError(""); }}>
      <fieldset disabled={pending}>{children}</fieldset>
      {state.error && (
        <p className="message error" role="alert">
          {state.error}
        </p>
      )}
      {uploadError && <p className="message error" role="alert">{uploadError}</p>}
      {state.success && (
        <p className="message success" role="status">
          {state.success}
        </p>
      )}
      {state.invitationUrl && <label className="field"><span>Link de invitație · valabil 7 zile</span><input className="input" readOnly value={state.invitationUrl} onFocus={(e) => e.target.select()}/><small>Linkul este destinat colegului indicat. Starea trimiterii emailului este afișată mai sus.</small></label>}
      <div>
        <Button disabled={pending}>{pending ? "Se salvează…" : submit}</Button>
      </div>
    </form>
  );
}
