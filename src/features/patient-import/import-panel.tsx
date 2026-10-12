"use client";
import { useState } from "react";
import { T } from "@/components/locale-provider";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input,Select } from "@/components/ui/form";
import { Table } from "@/components/ui/page";
import { commitImport } from "./actions";
import { importRows, importReport,importHeaders, type ImportRow } from "./model";
type Preview = {
  records: ImportRow[];
  report: ReturnType<typeof importReport.parse>;
};
export function ImportPanel({ cid }: { cid: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [generation,setGeneration]=useState(0);
  const [headers,setHeaders]=useState<string[]>([]);const [mapping,setMapping]=useState<Record<string,string>>({});
  const labels:Record<string,string>={name:"Nume și prenume",internal_id:"Cod intern",birth_date:"Data nașterii",phone:"Telefon",email:"Email"};
  async function read(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("phase",headers.length?"preview":"headers");if(headers.length)form.set("mapping",JSON.stringify(mapping));
    setPreview(null);
    setErrors([]);
    setMessage("");
    setPending(true);
    try {
      const response = await fetch(`/api/clinics/${cid}/patients/import`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Fișierul nu a putut fi citit.");
      if(data.headers){setHeaders(data.headers);const aliases:Record<string,string[]>={name:["name","nume","nume și prenume","nume complet"],internal_id:["internal_id","cod intern","cod","id"],birth_date:["birth_date","data nașterii","data nasterii"],phone:["phone","telefon"],email:["email","e-mail"]};setMapping(Object.fromEntries(importHeaders.map(key=>[key,data.headers.find((h:string)=>aliases[key].includes(h))??""])));return;}
      if (data.errors?.length) {
        setErrors(data.errors);
        return;
      }
      setPreview({
        records: importRows.parse(data.records),
        report: importReport.parse(data.report),
      });
      setGeneration(value=>value+1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Fișierul nu a putut fi citit.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="form-stack">
      <p>
        <T>
          {
            "CSV sau Excel .xlsx, o singură foaie, maximum 500 de pacienți și 2 MB. Datele existente nu sunt suprascrise."
          }
        </T>
      </p>
      <p>
        <a className="text-link" href="/templates/patients-import.csv" download>
          <T>{"Descarcă modelul CSV"}</T>
        </a>
      </p>
      <p className="muted">
        <T>
          {
            "Coloane: name (nume), internal_id (cod intern), birth_date (AAAA-LL-ZZ), phone (telefon), email. Păstrați codul intern și telefonul ca text în Excel."
          }
        </T>
      </p>
      <form onSubmit={read} className="form-stack">
        <Field label="Fișier">
          <Input
            name="file"
            type="file"
            accept=".csv,.xlsx"
            required
            onChange={() => {
              setPreview(null);
              setErrors([]);
              setMessage("");
              setHeaders([]);setMapping({});
            }}
          />
        </Field>
        {headers.length>0&&<fieldset className="form-stack"><legend><T>{"Alegeți coloana din fișier pentru fiecare câmp"}</T></legend>{importHeaders.map(key=><Field key={key} label={labels[key]}><Select value={mapping[key]??""} required={["name","internal_id"].includes(key)} onChange={e=>{setMapping({...mapping,[key]:e.target.value});setPreview(null);}}><option value=""><T>{["name","internal_id"].includes(key)?"Selectează coloana":"Nu importa acest câmp"}</T></option>{headers.map(header=><option key={header} value={header}>{header}</option>)}</Select></Field>)}</fieldset>}
        <Button disabled={pending}>
          <T>
            {pending ? "Se verifică fișierul…" : headers.length?"Verifică și previzualizează":"Alege coloanele"}
          </T>
        </Button>
      </form>
      {message && (
        <p role="alert" className="message error">
          {message}
        </p>
      )}
      {errors.length > 0 && (
        <div className="message error" role="alert">
          <p>
            <T>
              {
                "Corectați toate erorile și încărcați din nou fișierul. Nu s-a importat nimic."
              }
            </T>
          </p>
          <ul>
            {errors.map((error, i) => (
              <li key={i}>
                <T>{"Rând"}</T> {error.row}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview && (
        <div className="form-stack">
          <p>
            <strong>{preview.report.created}</strong> <T>{"pacienți noi"}</T> ·{" "}
            <strong>{preview.report.skipped}</strong> <T>{"duplicate omise"}</T>
          </p>
          <Table>
            <thead>
              <tr>
                {[
                  "Nume",
                  "Cod intern",
                  "Data nașterii",
                  "Telefon",
                  "Email",
                  "Import",
                ].map((label) => (
                  <th key={label}>
                    <T>{label}</T>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.records.map((row, i) => (
                <tr key={i}>
                  <td>{row.name}</td>
                  <td>{row.internal_id}</td>
                  <td>{row.birth_date || "—"}</td>
                  <td>{row.phone || "—"}</td>
                  <td>{row.email || "—"}</td>
                  <td>
                    <T>
                      {preview.report.rows[i].status === "NEW"
                        ? "Va fi adăugat"
                        : "Duplicat · omis"}
                    </T>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ActionForm
            key={generation}
            action={commitImport.bind(null, cid)}
            lockAfterSuccess
            submit="Importă pacienții verificați"
          >
            <input
              type="hidden"
              name="records"
              value={JSON.stringify(preview.records)}
            />
            <label className="check-field">
              <input type="checkbox" name="confirmed" required />
              <T>
                {"Am verificat datele și confirm importul în această clinică."}
              </T>
            </label>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
