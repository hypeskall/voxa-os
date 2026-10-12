"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/components/locale-provider";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useDirtyFormGuard } from "@/components/ui/use-dirty-form";
import { encryptMedicalFileInBrowser } from "@/lib/medical-file-format";
export function DirectUpload({
  cid,
  pid,
  types = [],
  result = false,
}: {
  cid: string;
  pid: string;
  types?: { id: string; name: string }[];
  result?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => () => xhrRef.current?.abort(), []);
  useDirtyFormGuard(formRef, pending);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || file.size > 20 * 1024 * 1024) {
      setMessage("Fișierul poate avea cel mult 20 MB.");
      return;
    }
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true);
    setSuccess(false);
    setMessage("");
    setProgress(0);
    const endpoint = `/api/clinics/${cid}/patients/${pid}/uploads`;
    const post = async (body: unknown) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Încărcarea nu a reușit.");
      return data;
    };
    try {
      const prepared = await post({
        phase: "prepare",
        metadata: {
          title: fields.get("title"),
          document_type_id: result
            ? "00000000-0000-4000-8000-000000000001"
            : fields.get("document_type_id"),
          file_name: file.name,
          mime: file.type,
          bytes: file.size,
          result,
          visible_to_patient: fields.get("visible_to_patient") === "on",
        },
      });
      const encrypted = await encryptMedicalFileInBrowser(file, prepared.encryption);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", prepared.url);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Transferul nu a reușit. Încercați din nou."));
        };
        xhr.onerror = () =>
          reject(new Error("Conexiunea s-a întrerupt. Încercați din nou."));
        xhr.onabort = () => reject(new Error("Transfer anulat."));
        xhr.timeout = 120000;
        xhr.ontimeout = () =>
          reject(new Error("Transferul a durat prea mult."));
        const body = new FormData();
        body.append("cacheControl", "0");
        body.append("", encrypted, "medical.enc");
        xhr.send(body);
      });
      await post({ phase: "complete", receipt: prepared.receipt });
      delete form.dataset.dirty;
      form.reset();
      setFile(null);
      setPreview("");
      setSuccess(true);
      setMessage("Fișierul a fost verificat și înregistrat.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Încărcarea nu a reușit.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      ref={formRef}
      onSubmit={upload}
      onChange={() => {
        if (formRef.current) formRef.current.dataset.dirty = "true";
      }}
      className="form-stack"
    >
      <fieldset disabled={pending}>
        <Field label={result ? "Titlu rezultat" : "Titlu"}>
          <Input name="title" required minLength={2} maxLength={200} />
        </Field>
        {!result && (
          <Field label="Tip document">
            <Select name="document_type_id">
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label={result ? "Fișier rezultat" : "Fișier"}
          hint="PDF, PNG, JPEG sau WebP, maximum 20 MB."
        >
          <Input
            name="file"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            required
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              setPreview(chosen ? URL.createObjectURL(chosen) : "");
              setMessage("");
            }}
          />
        </Field>
        {file && (
          <div>
            <p>
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
            {preview && (
              <a
                className="text-link"
                href={preview}
                target="_blank"
                rel="noopener noreferrer"
              >
                <T>{"Deschide fișierul pentru verificare"}</T>
              </a>
            )}
          </div>
        )}
        <label className="checkbox-line">
          <input name="visible_to_patient" type="checkbox" />
          <T>{" Vizibil în portalul pacientului"}</T>
        </label>
        <p className="muted">
          <T>
            {
              "Implicit, fișierul este intern. Bifați vizibilitatea numai după verificarea pacientului și a conținutului."
            }
          </T>
        </p>
        <label className="checkbox-line">
          <input name="verified" type="checkbox" required />
          <T>
            {"Am verificat pacientul, fișierul și vizibilitatea în portal."}
          </T>
        </label>
      </fieldset>
      {pending && (
        <div role="status">
          <progress value={progress} max={100} />
          <p>
            {progress}% ·{" "}
            <T>
              {progress === 100
                ? "Se verifică documentul…"
                : "Se încarcă fișierul…"}
            </T>
          </p>
        </div>
      )}
      {message && (
        <p
          role={success ? "status" : "alert"}
          className={`message ${success ? "success" : "error"}`}
        >
          <T>{message}</T>
        </p>
      )}
      <Button disabled={pending}>
        <T>
          {pending ? "Se încarcă…" : result ? "Încarcă rezultatul" : "Încarcă"}
        </T>
      </Button>
    </form>
  );
}
