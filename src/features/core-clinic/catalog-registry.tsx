"use client";
import { T, LocaleMessage } from "@/components/locale-provider";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, Search, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Table } from "@/components/ui/page";
import {
  listInputSchema,
  listResultSchema,
  type CoreRow,
  type ListInput,
  type Option,
} from "./model";

type CatalogModule = "doctors" | "services";

function text(row: CoreRow, key: string) {
  const value = row[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function CatalogRegistry({
  cid,
  module,
  initial,
  filterOptions,
  emptyAction,
}: {
  cid: string;
  module: CatalogModule;
  initial: { items: CoreRow[]; total: number };
  filterOptions: Option[];
  emptyAction?: React.ReactNode;
}) {
  const [input, setInput] = useState<ListInput>(() => listInputSchema.parse({}));
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = useRef(true);

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
        if (!abort.signal.aborted) setError("Lista nu a putut fi actualizată.");
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [cid, input, module]);

  const update = (values: Partial<ListInput>) =>
    setInput((current) => ({ ...current, ...values, page_number: 1 }));

  return (
    <section className={`catalog-workspace catalog-${module}`}>
      <div className="catalog-toolbar">
        <label className="search-field">
          <Search size={16} />
          <Input
            aria-label={module === "doctors" ? "Caută medic" : "Caută serviciu"}
            placeholder={module === "doctors" ? "Caută după nume…" : "Caută serviciu sau investigație…"}
            value={input.query}
            onChange={(event) => update({ query: event.target.value })}
          />
        </label>
        <Select
          aria-label={module === "doctors" ? "Specialitate" : "Categorie"}
          value={input.filter_id ?? ""}
          onChange={(event) => update({ filter_id: event.target.value || null })}
        >
          <option value=""><T>{module === "doctors" ? "Toate specialitățile" : "Toate categoriile"}</T></option>
          {filterOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </Select>
        <Select aria-label="Status" value={input.state} onChange={(event) => update({ state: event.target.value as ListInput["state"] })}>
          <option value="active"><T>{"Active"}</T></option>
          <option value="inactive"><T>{"Inactive"}</T></option>
          <option value="all"><T>{"Toate, fără cele arhivate"}</T></option>
          <option value="archived"><T>{"Arhivate"}</T></option>
        </Select>
        <span className="catalog-count" aria-live="polite"><T>{busy ? "Se actualizează…" : <LocaleMessage template={"{0} rezultate"} values={[result.total]} />}</T></span>
      </div>
      {error && <p className="message error" role="alert"><T>{error}</T></p>}
      <Table>
        <thead>
          {module === "doctors" ? (
            <tr><th><T>{"Medic"}</T></th><th><T>{"Specialitate"}</T></th><th><T>{"Servicii"}</T></th><th><T>{"Program"}</T></th><th><T>{"Status"}</T></th><th><span className="sr-only"><T>{"Acțiuni"}</T></span></th></tr>
          ) : (
            <tr><th><T>{"Serviciu"}</T></th><th><T>{"Categorie"}</T></th><th><T>{"Durată"}</T></th><th><T>{"Resurse"}</T></th><th><T>{"Medici"}</T></th><th><T>{"Status"}</T></th><th><span className="sr-only"><T>{"Acțiuni"}</T></span></th></tr>
          )}
        </thead>
        <tbody>
          {result.items.map((row) => module === "doctors" ? (
            <tr key={row.id}>
              <td className="name-cell"><Link className="row-link" href={`/clinics/${cid}/doctors/${row.id}`}>{row.name}</Link><small className="table-subtitle">{text(row,"professional_code")}</small></td>
              <td>{text(row,"speciality_names") || "Neconfigurată"}</td>
              <td className="cell-clamp">{text(row,"service_names") || "Niciun serviciu asociat"}</td>
              <td>{Number(row.availability_count ?? 0) > 0 ? <span className="schedule-state ready"><Clock3 size={14}/><T>{"Configurat"}</T></span> : <span className="schedule-state"><Clock3 size={14}/><T>{"Neconfigurat"}</T></span>}</td>
              <td><span className={`status ${row.active && !row.archived_at ? "" : "inactive"}`}><T>{row.archived_at ? "Arhivat" : row.active ? "Activ" : "Inactiv"}</T></span></td>
              <td><Link className="text-link" href={`/clinics/${cid}/doctors/${row.id}`}><T>{"Profil"}</T></Link></td>
            </tr>
          ) : (
            <tr key={row.id}>
              <td className="name-cell"><Link className="row-link" href={`/clinics/${cid}/services/${row.id}`}>{row.name}</Link></td>
              <td>{text(row,"category_name") || "Fără categorie"}</td>
              <td><strong>{text(row,"duration_minutes")}<T>{" min"}</T></strong>{row.duration_is_demo_default === true && <small className="demo-label"><T>{"valoare demo"}</T></small>}</td>
              <td className="cell-clamp">{[text(row,"room_names"), text(row,"equipment_names")].filter(Boolean).join(" · ") || "Neconfigurate"}</td>
              <td className="cell-clamp">{text(row,"doctor_names") || "Neasociați"}</td>
              <td><span className={`status ${row.active && !row.archived_at ? "" : "inactive"}`}><T>{row.archived_at ? "Arhivat" : row.active ? "Activ" : "Inactiv"}</T></span></td>
              <td><Link className="text-link" href={`/clinics/${cid}/services/${row.id}`}><T>{"Configurează"}</T></Link></td>
            </tr>
          ))}
          {!result.items.length && (
            <tr><td colSpan={module === "doctors" ? 6 : 7}>
              <div className="action-empty">
                {module === "doctors" ? <Stethoscope size={22}/> : <Clock3 size={22}/>} 
                <div><strong><T>{module === "doctors" ? "Nu există medici pentru filtrele selectate." : "Nu există servicii pentru filtrele selectate."}</T></strong><p><T>{"Modificați filtrele sau creați prima înregistrare."}</T></p></div>
                {emptyAction}
              </div>
            </td></tr>
          )}
        </tbody>
      </Table>
      <div className="pagination">
        <Button variant="outline" size="sm" disabled={busy || input.page_number === 1} onClick={() => setInput({ ...input, page_number: input.page_number - 1 })}><T>{"Înapoi"}</T></Button>
        <span className="muted"><T>{"Pagina "}</T>{input.page_number}<T>{" din "}</T>{Math.max(1, Math.ceil(result.total / 25))}</span>
        <Button variant="outline" size="sm" disabled={busy || input.page_number * 25 >= result.total} onClick={() => setInput({ ...input, page_number: input.page_number + 1 })}><T>{"Înainte"}</T></Button>
      </div>
    </section>
  );
}
