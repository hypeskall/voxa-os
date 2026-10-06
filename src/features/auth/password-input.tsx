"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { T } from "@/components/locale-provider";
import { Input } from "@/components/ui/form";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);

  return (
    <span className="password-input-wrap">
      <Input {...props} type={visible ? "text" : "password"} />
      {ready && (
        <button
          className="password-visibility-toggle"
          type="button"
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <T>{visible ? "Ascunde" : "Arată"}</T>
        </button>
      )}
    </span>
  );
}

export function PasswordField({ label, ...inputProps }: PasswordInputProps & { label: string }) {
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id}><T>{label}</T></label>
      <PasswordInput {...inputProps} id={id} />
    </div>
  );
}
