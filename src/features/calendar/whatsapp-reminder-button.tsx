"use client";
import { T } from "@/components/locale-provider";
import { useState, useTransition } from "react";
import { FaWhatsapp } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { renderReminderTemplate, whatsappUrl, type ReminderVariables } from "@/lib/phone";
import { openWhatsappReminderAction } from "./actions";

export function WhatsappReminderButton({ clinicId, appointmentId, phone, template, variables, recommended = false }: { clinicId: string; appointmentId: string; phone: string; template: string; variables: ReminderVariables; recommended?: boolean }) {
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const url = whatsappUrl(phone, renderReminderTemplate(template, variables));
  return <div className="whatsapp-reminder-action">
    <Button type="button" variant="outline" size="sm" disabled={!url || pending} onClick={() => {
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
      startTransition(async () => {
        const response = await openWhatsappReminderAction(clinicId, appointmentId);
        if (response.ok) { setOpenedAt(String(response.data)); setError(""); }
        else setError(response.error);
      });
    }}><FaWhatsapp aria-hidden /><T>{" Deschide WhatsApp"}</T><T>{recommended ? " · recomandat" : ""}</T></Button>
    {!url && <small><T>{"Pacientul nu are un număr de telefon valid."}</T></small>}
    {openedAt && <small><T>{"WhatsApp deschis la "}</T>{new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date(openedAt))}</small>}
    {error && <small className="form-error"><T>{error}</T></small>}
  </div>;
}
