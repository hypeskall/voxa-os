"use client";
import { T } from "@/components/locale-provider";
import { useActionState, useState, useRef, useEffect } from "react";
import type { ActionState } from "@/features/auth/actions";
import { Button } from "./button";
import { MAX_UPLOAD_BYTES } from "@/lib/medical-storage";
import { FormFeedback } from "./form-feedback";
import { useDirtyFormGuard } from "./use-dirty-form";
export function ActionForm({
  action,
  children,
  submit = "Salvează modificările",
  lockAfterSuccess = false,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submit?: string;
  lockAfterSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [uploadError, setUploadError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);
  useDirtyFormGuard(formRef, pending);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (state.success) {
      delete form.dataset.dirty;
      submitted.current = null;
    }
    if (state.error) {
      form.dataset.dirty = "true";
      for (const control of Array.from(form.elements)) {
        if (
          !(
            control instanceof HTMLInputElement ||
            control instanceof HTMLTextAreaElement ||
            control instanceof HTMLSelectElement
          ) ||
          !control.name ||
          !submitted.current
        )
          continue;
        const values = submitted.current.getAll(control.name);
        if (control instanceof HTMLInputElement) {
          if (control.type === "file") continue;
          if (control.type === "checkbox" || control.type === "radio") {
            control.checked = values.includes(control.value);
            continue;
          }
        }
        if (control instanceof HTMLSelectElement && control.multiple) {
          for (const option of control.options)
            option.selected = values.includes(option.value);
        } else if (typeof values[0] === "string") control.value = values[0];
      }
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);
  return (
    <form
      ref={formRef}
      action={formAction}
      className="form-stack"
      onChange={() => {
        if (formRef.current) formRef.current.dataset.dirty = "true";
      }}
      onSubmit={(e) => {
        const data = new FormData(e.currentTarget);
        const total = [...data.values()].reduce(
          (sum, value) => sum + (value instanceof File ? value.size : 0),
          0,
        );
        if (total > MAX_UPLOAD_BYTES) {
          e.preventDefault();
          setUploadError(
            "Fișierele selectate pot avea împreună cel mult 3 MB.",
          );
        } else {
          setUploadError("");
          submitted.current = data;
        }
      }}
    >
      <FormFeedback.Provider value={state.fieldErrors ?? {}}>
        <fieldset disabled={pending || (lockAfterSuccess && Boolean(state.success))}>{children}</fieldset>
      </FormFeedback.Provider>
      {state.error && (
        <p className="message error" role="alert">
          <T>{state.error}</T>
        </p>
      )}
      {uploadError && (
        <p className="message error" role="alert">
          <T>{uploadError}</T>
        </p>
      )}
      {state.success && (
        <p className="message success" role="status">
          <T>{state.success}</T>
        </p>
      )}
      {state.invitationUrl && (
        <label className="field">
          <span>
            <T>{"Link de invitație · valabil 7 zile"}</T>
          </span>
          <input
            className="input"
            readOnly
            value={state.invitationUrl}
            onFocus={(e) => e.target.select()}
          />
          <small>
            <T>
              {
                "Linkul este destinat colegului indicat. Starea trimiterii emailului este afișată mai sus."
              }
            </T>
          </small>
        </label>
      )}
      <div>
        <Button disabled={pending || (lockAfterSuccess && Boolean(state.success))}>
          <T>{pending ? "Se salvează…" : submit}</T>
        </Button>
      </div>
    </form>
  );
}
