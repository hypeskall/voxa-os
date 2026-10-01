"use client";
import { useActionState, startTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validation";
import { login } from "./actions";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit((data) => {
        const form = new FormData();
        form.set("identifier", data.identifier);
        form.set("password", data.password);
        startTransition(() => action(form));
      })}
    >
      <Field label="Utilizator">
        <Input
          type="text"
          autoComplete="username"
          autoFocus
          autoCapitalize="none"
          spellCheck={false}
          {...register("identifier")}
          aria-invalid={!!errors.identifier}
        />
      </Field>
      <Field label="Parolă">
        <Input
          type="password"
          autoComplete="current-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
      </Field>
      <p className="muted">Puteți folosi și adresa de email a contului existent.</p>
      {(errors.identifier || errors.password) && (
        <p role="alert" className="message error">
          Completați un utilizator valid și parola.
        </p>
      )}
      {state.error && (
        <p role="alert" className="message error">
          {state.error}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Se verifică…" : "Conectare"}
      </Button>
    </form>
  );
}
