"use client";
import { useActionState, startTransition, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validation";
import { login } from "./actions";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function LoginForm({ next = "/" }: { next?: string }) {
  const [state, action, pending] = useActionState(login, {});
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });
  return (
    <form
      method="post"
      className="form-stack"
      onSubmit={handleSubmit((data) => {
        const form = new FormData();
        form.set("identifier", data.identifier);
        form.set("password", data.password);
        form.set("next", next);
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
          disabled={!ready || pending}
          {...register("identifier")}
          aria-invalid={!!errors.identifier}
        />
      </Field>
      <Field label="Parolă">
        <Input
          type="password"
          autoComplete="current-password"
          disabled={!ready || pending}
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
      <Button disabled={!ready || pending}>
        {pending ? "Se verifică…" : "Conectare"}
      </Button>
    </form>
  );
}
