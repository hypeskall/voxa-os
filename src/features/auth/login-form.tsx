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
        form.set("email", data.email);
        form.set("password", data.password);
        startTransition(() => action(form));
      })}
    >
      <Field label="Adresă de email">
        <Input
          type="email"
          autoComplete="username"
          autoFocus
          {...register("email")}
          aria-invalid={!!errors.email}
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
      {(errors.email || errors.password) && (
        <p role="alert" className="message error">
          Completați un email valid și parola.
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
