"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/form";
import type { CoreModule, Option } from "./model";
export function RelationPicker({
  cid,
  module,
  name,
  label,
  multiple = false,
  initialOptions,
  initialIds = [],
}: {
  cid: string;
  module: CoreModule;
  name: string;
  label: string;
  multiple?: boolean;
  initialOptions: Option[];
  initialIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState(initialOptions);
  const [selected, setSelected] = useState(initialIds);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        selected.forEach((id) => params.append("selected", id));
        const response = await fetch(
          `/clinics/${cid}/data/${module}?${params}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        setOptions(await response.json());
        setError("");
      } catch {
        if (!controller.signal.aborted)
          setError("Opțiunile nu au putut fi actualizate.");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, cid, module, selected]);
  function toggle(id: string) {
    setSelected((current) =>
      multiple
        ? current.includes(id)
          ? current.filter((v) => v !== id)
          : [...current, id]
        : current.includes(id)
          ? []
          : [id],
    );
  }
  return (
    <fieldset className="relation-picker">
      <legend>{label}</legend>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {!multiple && !selected.length && (
        <input type="hidden" name={name} value="" />
      )}
      <Input
        aria-label={`Caută: ${label}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Caută în această clinică…"
      />
      <div className="relation-options">
        {options.map((option) => (
          <label className="relation-option" key={option.id}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={`${name}_selection`}
              checked={selected.includes(option.id)}
              onChange={() => toggle(option.id)}
            />
            <span>
              {option.name}
              {!option.active && <small> · inactiv / arhivat</small>}
            </span>
          </label>
        ))}
        {!options.length && (
          <p className="muted">
            Nu există opțiuni. Adăugați mai întâi înregistrarea în modulul
            corespunzător.
          </p>
        )}
      </div>
      {!multiple && selected.length > 0 && (
        <button
          type="button"
          className="text-link"
          onClick={() => setSelected([])}
        >
          Elimină selecția
        </button>
      )}
      <small>{selected.length} selectate · căutare în clinică</small>
      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
