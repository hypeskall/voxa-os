"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { defaultWhatsappReminderTemplate, renderReminderTemplate } from "@/lib/phone";

export function WhatsappTemplateField({ defaultValue = defaultWhatsappReminderTemplate }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const preview = renderReminderTemplate(value, {
    patient_first_name: "Andrei", patient_name: "Andrei Popescu", date: "01.10.2026", time: "10:30",
    service_name: "Consultație", doctor_name: "Dr. Maria Ionescu", clinic_name: "Clinica Maria",
    clinic_address: "Str. Sovata nr. 20", clinic_phone: "0712 000 000",
  });
  return <section className="whatsapp-template-settings">
    <div><strong>Remindere WhatsApp</strong><p className="muted">Mesajul se deschide manual în WhatsApp. Variabile: patient_first_name, patient_name, date, time, service_name, doctor_name, clinic_name, clinic_address, clinic_phone.</p></div>
    <Field label="Mesaj implicit"><textarea className="input textarea" name="whatsapp_reminder_template" rows={5} minLength={20} maxLength={4000} value={value} onChange={(event) => setValue(event.target.value)} /></Field>
    <div className="message-preview"><small>Previzualizare</small><p>{preview}</p></div>
    <Button type="button" variant="ghost" size="sm" onClick={() => setValue(defaultWhatsappReminderTemplate)}>Revino la mesajul implicit</Button>
  </section>;
}
