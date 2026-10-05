"use client";
import { T, useLocale, LocaleMessage } from "@/components/locale-provider";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/page";
import {
  moduleSpecs,
  listInputSchema,
  listResultSchema,
  valueText,
  type CoreModule,
  type CoreRow,
  type Option,
} from "./model";
const labels: Record<string, string> = {
  clinic: "Clinică",
  doctor: "Medic",
  room: "Cabinet",
  equipment: "Echipament",
  work: "Lucru",
  break: "Pauză",
  closed: "Indisponibil",
  holiday: "Sărbătoare",
  leave: "Concediu",
  maintenance: "Mentenanță",
  meeting: "Ședință",
  manual: "Blocare",
  extra_work: "Program suplimentar",
};
export function displayValue(row: CoreRow, key: string, timeZone: string, locale = "ro") {
  const value = valueText(row, key);
  if (!value) return "—";
  if (key === "weekday")
    return [
      "",
      "Luni",
      "Marți",
      "Miercuri",
      "Joi",
      "Vineri",
      "Sâmbătă",
      "Duminică",
    ][Number(value)];
  if (
    key === "resource_kind" ||
    key === "interval_kind" ||
    key === "exception_kind"
  )
    return labels[value] ?? value;
  if (key === "price")
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "RON",
    }).format(Number(value));
  if (key === "starts_at" || key === "ends_at")
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  return value;
}
export function Registry({
  cid,
  module,
  initial,
  timeZone,
  filterOptions = [],
  initialFilter = null,
  visibleColumnKeys,
  emptyAction,
}: {
  cid: string;
  module: CoreModule;
  initial: { items: CoreRow[]; total: number };
  timeZone: string;
  filterOptions?: Option[];
  initialFilter?: string | null;
  visibleColumnKeys?: string[];
  emptyAction?: React.ReactNode;
}) {
  const { locale, t } = useLocale();
  const [input, setInput] = useState(() =>
    listInputSchema.parse({ filter_id: initialFilter }),
  );
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = useRef(true);
  const columns = moduleSpecs[module].columns.filter(([key]) =>
    key === "name" || !visibleColumnKeys || visibleColumnKeys.includes(key),
  );
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/clinics/${cid}/data/${module}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: abort.signal,
        });
        if (!response.ok) throw new Error();
        setResult(listResultSchema.parse(await response.json()));
        setError("");
      } catch {
        if (!abort.signal.aborted)
          setError(
            "Lista nu a putut fi actualizată. Modificați filtrul pentru a reîncerca.",
          );
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [input, cid, module]);
  return (
    <>
      <div className="registry-toolbar">
        <Input
          value={input.query}
          onChange={(e) =>
            setInput({ ...input, query: e.target.value, page_number: 1 })
          }
          placeholder={
            module === "patients"
              ? "Nume, telefon, email sau identificator…"
              : "Caută după nume sau identificator…"
          }
          aria-label="Caută în listă"
          maxLength={100}
        />
        <Select
          aria-label="Filtrează după stare"
          value={input.state}
          onChange={(e) =>
            setInput({
              ...input,
              state: e.target.value as typeof input.state,
              page_number: 1,
            })
          }
        >
          <option value="active"><T>{"Active"}</T></option>
          <option value="inactive"><T>{"Inactive"}</T></option>
          <option value="all"><T>{"Toate ne-arhivate"}</T></option>
          <option value="archived"><T>{"Arhivate"}</T></option>
        </Select>
        {filterOptions.length > 0 && (
          <Select
            aria-label="Filtru categorie sau specialitate"
            value={input.filter_id ?? ""}
            onChange={(e) =>
              setInput({
                ...input,
                filter_id: e.target.value || null,
                page_number: 1,
              })
            }
          >
            <option value=""><T>{"Toate categoriile / specialitățile"}</T></option>
            {filterOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          aria-label="Sortare"
          value={`${input.sort_key}:${input.descending}`}
          onChange={(e) => {
            const [key, direction] = e.target.value.split(":");
            setInput({
              ...input,
              sort_key: key as typeof input.sort_key,
              descending: direction === "true",
              page_number: 1,
            });
          }}
        >
          <option value="name:false"><T>{"Nume A–Z"}</T></option>
          <option value="name:true"><T>{"Nume Z–A"}</T></option>
          <option value="created_at:true"><T>{"Cele mai noi"}</T></option>
          <option value="updated_at:true"><T>{"Modificate recent"}</T></option>
        </Select>
      </div>
      <div className="toolbar">
        <p className="muted" aria-live="polite">
          <T>{busy ? "Se actualizează…" : <LocaleMessage template={"{0} înregistrări"} values={[result.total]} />}</T>
        </p>
        {initialFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setInput({ ...input, filter_id: null, page_number: 1 })
            }
          ><T>{"Toate resursele"}</T></Button>
        )}
      </div>
      {error && (
        <p role="alert" className="message error mb-4">
          <T>{error}</T>
        </p>
      )}
      <div aria-busy={busy}>
        <Table>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key}><T>{label}</T></th>
              ))}
              <th><T>{"Stare"}</T></th>
              <th>
                <span className="sr-only"><T>{"Acțiuni"}</T></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr key={row.id}>
                {columns.map(([key]) => (
                  <td
                    key={key}
                    className={key === "name" ? "name-cell" : undefined}
                  >
                    {key === "name" ? (
                      <Link
                        href={`/clinics/${cid}/${module}/${row.id}`}
                        className="row-link"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      ["weekday", "resource_kind", "interval_kind", "exception_kind"].includes(key) ? t(displayValue(row, key, timeZone, locale)) : displayValue(row, key, timeZone, locale)
                    )}
                  </td>
                ))}
                <td>
                  <span
                    className={`status ${row.active && !row.archived_at ? "" : "inactive"}`}
                  >
                    <T>{row.archived_at
                      ? "Arhivat"
                      : row.active
                        ? "Activ"
                        : "Inactiv"}</T>
                  </span>
                </td>
                <td>
                  <Link
                    className="text-link"
                    aria-label={`Deschide ${row.name}`}
                    href={`/clinics/${cid}/${module}/${row.id}`}
                  ><T>{"Deschide"}</T></Link>
                </td>
              </tr>
            ))}
            {!result.items.length && (
              <tr>
                <td colSpan={columns.length + 2}>
                  <div className="action-empty">
                    <div>
                      <strong><T>{"Nu există înregistrări pentru filtrele selectate."}</T></strong>
                      <p><T>{"Modificați filtrele sau adăugați prima înregistrare."}</T></p>
                    </div>
                    {emptyAction}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
      <div className="pagination">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || input.page_number === 1}
          onClick={() =>
            setInput({ ...input, page_number: input.page_number - 1 })
          }
        ><T>{"Înapoi"}</T></Button>
        <span className="muted"><T>{"Pagina "}</T>{input.page_number}<T>{" din"}</T><T>{" "}</T>
          {Math.max(1, Math.ceil(result.total / 25))}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || input.page_number * 25 >= result.total}
          onClick={() =>
            setInput({ ...input, page_number: input.page_number + 1 })
          }
        ><T>{"Înainte"}</T></Button>
      </div>
    </>
  );
}
