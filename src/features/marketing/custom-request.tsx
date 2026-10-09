"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function CustomRequest({ email }: { email: string }) {
  const [draft, setDraft] = useState<string>();
  const [message, setMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus("Cererea a fost copiată. O poți lipi într-un email.");
    } catch {
      setCopyStatus(
        "Copierea nu este disponibilă. Selectează textul cererii de mai jos.",
      );
    }
  }
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = `Bună! Aș dori să discut o soluție personalizată pentru clinica mea.\n\nNume: ${data.get("name")}\nClinică: ${data.get("clinic")}\nEmail: ${data.get("email")}\nTelefon: ${data.get("phone") || "Nespecificat"}\nDirecție: ${data.get("interest")}\n\nCe avem nevoie:\n${data.get("message")}\n`;
    setDraft(
      `mailto:${email}?subject=${encodeURIComponent(`Voxa Custom — ${data.get("clinic")}`)}&body=${encodeURIComponent(body)}`,
    );
    setMessage(body);
    setCopyStatus("");
  }
  return (
    <form
      className="custom-form"
      onSubmit={prepare}
      onChange={() => setDraft(undefined)}
    >
      <h3>Spune-ne despre proiect</h3>
      <p className="custom-form-subtitle">
        Câteva detalii sunt suficiente pentru primul pas.
      </p>
      <div className="custom-form-row">
        <label>
          Numele tău
          <input
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            placeholder="Dr. Andrei Popescu"
          />
        </label>
        <label>
          Clinică / cabinet
          <input
            name="clinic"
            autoComplete="organization"
            required
            maxLength={150}
            placeholder="Numele clinicii"
          />
        </label>
      </div>
      <div className="custom-form-row">
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={150}
            placeholder="nume@clinica.ro"
          />
        </label>
        <label>
          Telefon <small>(opțional)</small>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="07xx xxx xxx"
          />
        </label>
      </div>
      <label>
        Ce te interesează?
        <select name="interest" defaultValue="Încă explorez">
          <option>Încă explorez</option>
          <option>Programări și organizare</option>
          <option>Automatizarea proceselor</option>
          <option>Portal / website pentru clinică</option>
          <option>Integrări cu aplicații existente</option>
          <option>Altă soluție</option>
        </select>
      </label>
      <label>
        Ce ai vrea să rezolvi?
        <textarea
          name="message"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          placeholder="Cum lucrați acum? Ce vă consumă timp? Ce ai vrea să poată face soluția?"
        />
      </label>
      <p className="custom-form-hint">
        Minimum 20 de caractere. Nu include date despre pacienți.
      </p>
      <p className="custom-form-hint">
        Cererea se pregătește în aplicația ta de email; o verifici și o trimiți
        de acolo. <Link href="/legal/privacy">Confidențialitate</Link>
      </p>
      <button className="custom-button" type="submit">
        Pregătește cererea <ArrowUpRight size={18} />
      </button>
      {draft && (
        <div className="custom-form-result" role="status">
          <strong>Cererea este pregătită.</strong>
          <p>
            Deschide emailul, verifică detaliile și apasă Trimite în aplicația
            ta. Formularul nu a trimis încă mesajul.
          </p>
          <a className="custom-button" href={draft}>
            Deschide cererea în email <ArrowUpRight size={18} />
          </a>
          <details className="custom-email-fallback">
            <summary>Folosești emailul în browser?</summary>
            <p>
              Copiază cererea și trimite-o la{" "}
              <a href={`mailto:${email}`}>{email}</a>.
            </p>
            <textarea
              aria-label="Textul cererii pregătite"
              value={message}
              readOnly
              rows={7}
            />
            <button
              type="button"
              className="custom-copy-button"
              onClick={copyRequest}
            >
              Copiază cererea
            </button>
            <p aria-live="polite">{copyStatus}</p>
          </details>
        </div>
      )}
    </form>
  );
}
