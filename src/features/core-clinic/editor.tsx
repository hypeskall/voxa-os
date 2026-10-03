"use client";
import { useId, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { saveCoreAction } from "./actions";
import {
  moduleSpecs,
  valueText,
  valueIds,
  type CoreModule,
  type CoreRow,
  type Option,
} from "./model";
import { instantToLocal } from "./validation";
import { RelationPicker } from "./relation-picker";
export function CoreEditor({
  cid,
  module,
  row,
  options,
  timeZone,
  preset,
}: {
  cid: string;
  module: CoreModule;
  row?: CoreRow;
  options: Record<string, Option[]>;
  timeZone: string;
  preset?: { kind: string; id: string };
}) {
  const editorId = useId();
  const [resource, setResource] = useState(
    valueText(row, "resource_kind") || preset?.kind || "clinic",
  );
  return (
    <ActionForm
      action={saveCoreAction.bind(null, cid, module, row?.id ?? null)}
      submit={row ? "Salvează modificările" : "Creează înregistrarea"}
    >
      <input type="hidden" name="version" value={row?.updated_at ?? ""} />
      {moduleSpecs[module].fields.map((field) => {
        const hintId = field.hint ? `${editorId}-${field.key}-hint` : undefined;
        const expected = {
          doctor_location_id: "doctor",
          room_id: "room",
          equipment_id: "equipment",
        }[field.key as "doctor_location_id" | "room_id" | "equipment_id"];
        if (
          (module === "availability" || module === "exceptions") &&
          expected &&
          expected !== resource
        )
          return (
            <input key={field.key} type="hidden" name={field.key} value="" />
          );
        if (field.source) {
          const selected =
            field.kind === "multiple"
              ? valueIds(row, field.key)
              : valueText(row, field.key)
                ? [valueText(row, field.key)]
                : preset && expected === preset.kind
                  ? [preset.id]
                  : [];
          return (
            <div key={field.key}>
              <RelationPicker
                cid={cid}
                module={field.source}
                name={field.key}
                label={field.label}
                multiple={field.kind === "multiple"}
                initialOptions={options[field.key] ?? []}
                initialIds={selected}
              />
              {field.hint && <small>{field.hint}</small>}
            </div>
          );
        }
        let value =
          valueText(row, field.key) || String(field.defaultValue ?? "");
        if (field.kind === "lines") value = valueIds(row, field.key).join("\n");
        if (field.kind === "datetime" && value)
          value = instantToLocal(value, timeZone);
        return (
          <Field
            key={field.key}
            label={field.label}
            hint={field.hint}
            hintId={hintId}
          >
            {field.kind === "select" ? (
              <Select
                name={field.key}
                aria-label={field.label}
                aria-describedby={hintId}
                defaultValue={
                  field.key === "resource_kind"
                    ? resource
                    : value || field.options?.[0]?.[0]
                }
                onChange={
                  field.key === "resource_kind"
                    ? (e) => setResource(e.target.value)
                    : undefined
                }
              >
                {field.options?.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            ) : field.kind === "textarea" || field.kind === "lines" ? (
              <textarea
                aria-label={field.label}
                aria-describedby={hintId}
                className="input textarea"
                name={field.key}
                rows={4}
                maxLength={field.max ?? 20000}
                defaultValue={value}
              />
            ) : (
              <Input
                name={field.key}
                aria-label={field.label}
                aria-describedby={hintId}
                type={
                  field.kind === "datetime"
                    ? "datetime-local"
                    : (field.kind ?? "text")
                }
                required={field.required}
                minLength={field.key === "name" ? 2 : undefined}
                min={field.min}
                max={
                  field.max && field.kind === "number"
                    ? field.max
                    : field.key === "birth_date"
                      ? new Date().toISOString().slice(0, 10)
                      : undefined
                }
                maxLength={field.max}
                pattern={field.pattern}
                step={field.step}
                defaultValue={field.kind === "time" ? value.slice(0, 5) : value}
              />
            )}
          </Field>
        );
      })}
      <Field label="Stare">
        <Select
          name="active"
          defaultValue={row?.active === false ? "false" : "true"}
        >
          <option value="true">Activ</option>
          <option value="false">Inactiv</option>
        </Select>
      </Field>
      {(module === "availability" || module === "exceptions") && (
        <p className="muted">
          Fus orar: {timeZone}. Intervalele peste miezul nopții se configurează
          separat pe fiecare zi. Programul suplimentar se adaugă programului
          săptămânal; blocările au prioritate.
        </p>
      )}
    </ActionForm>
  );
}
