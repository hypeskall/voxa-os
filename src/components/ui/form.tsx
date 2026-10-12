"use client";
import { T, LocalizedElement } from "@/components/locale-provider";
import { useFieldError,FieldLabel,useFieldLabel } from "./form-feedback";
import { useId } from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  const error = useFieldError(props.name);
  const errorId = useId();
  const label=useFieldLabel();
  return <><LocalizedElement as="input" className={cn("input", className)} {...props} aria-labelledby={props["aria-labelledby"]??(props["aria-label"]?undefined:label.labelId)} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[props["aria-describedby"],label.hintId,error?errorId:null].filter(Boolean).join(" ")||undefined} />{error && <small id={errorId} className="field-error"><T>{error}</T></small>}</>;
}
export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  const error = useFieldError(props.name);
  const errorId = useId();
  const label=useFieldLabel();
  return <><LocalizedElement as="select" className={cn("input", className)} {...props} aria-labelledby={props["aria-labelledby"]??(props["aria-label"]?undefined:label.labelId)} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[props["aria-describedby"],label.hintId,error?errorId:null].filter(Boolean).join(" ")||undefined} />{error && <small id={errorId} className="field-error"><T>{error}</T></small>}</>;
}
export function Field({
  label,
  children,
  hint,
  hintId,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  hintId?: string;
}) {
  const labelId=useId();const descriptionId=hint?(hintId??`${labelId}-hint`):undefined;
  return (
    <label className="field">
      <span id={labelId}><T>{label}</T></span>
      <FieldLabel.Provider value={{labelId,hintId:descriptionId}}>{children}</FieldLabel.Provider>
      {hint && <small id={descriptionId}><T>{hint}</T></small>}
    </label>
  );
}
