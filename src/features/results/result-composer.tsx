"use client";
import { T } from "@/components/locale-provider";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { saveResult } from "./actions";
import type { ResultOption } from "./model";
import { formatInTimeZone } from "@/lib/time";

export function ResultComposer({ cid, options, timeZone }: { cid: string; options: ResultOption[]; timeZone: string }) {
  const [appointmentId, setAppointmentId] = useState("");
  const selected = options.find(option => option.id === appointmentId);
  if (!options.length) return <p className="muted"><T>{"Nu există programări eligibile cu medic asociat. Pentru un rezultat primit ca fișier, folosiți „Încarcă rezultat” din profilul pacientului."}</T></p>;
  return <ActionForm action={saveResult.bind(null, cid, null)} submit="Creează ciornă">
    <Field label="Programare"><Select name="appointment_id" required value={appointmentId} onChange={event => setAppointmentId(event.target.value)}><option value=""><T>{"Selectați"}</T></option>{options.map(option => <option key={option.id} value={option.id}>{option.patient_name} · {option.service_name} · {formatInTimeZone(option.start_at, timeZone)}</option>)}</Select></Field>
    <input type="hidden" name="doctor_id" value={selected?.doctor_id ?? ""}/>
    <Field label="Medic"><Input readOnly value={selected?.doctor_name ?? "Selectați mai întâi programarea"}/></Field>
    <Field label="Titlu"><Input name="title" required minLength={2} maxLength={200} defaultValue="Rezultat medical"/></Field>
    <Field label="Conținut"><textarea className="input textarea result-editor" name="content" required maxLength={100000}/></Field>
  </ActionForm>;
}
