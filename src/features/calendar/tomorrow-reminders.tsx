"use client";

import { FaWhatsapp } from "react-icons/fa6";
import { T } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { formatRomanianDate } from "@/lib/locale/ro";
import { WhatsappReminderButton } from "./whatsapp-reminder-button";
import type { WhatsappReminder } from "./whatsapp-reminders-model";

export function TomorrowReminders({ clinicId, clinicName, clinicAddress, clinicPhone, template, timeZone, date, reminders }: {
  clinicId: string; clinicName: string; clinicAddress: string; clinicPhone: string;
  template: string; timeZone: string; date: string; reminders: WhatsappReminder[];
}) {
  const clock = new Intl.DateTimeFormat("ro-RO", { timeZone, hour: "2-digit", minute: "2-digit" });
  return <Panel drawer title="Remindere pentru mâine"
    description="Deschide conversația cu mesajul pregătit. Confirmă trimiterea în WhatsApp."
    trigger={<Button variant="outline" size="sm"><FaWhatsapp aria-hidden /><T>{"Remindere pentru mâine"}</T>{` (${reminders.length})`}</Button>}>
    <p><strong>{formatRomanianDate(date)}</strong></p>
    <div className="reminder-list">
      {reminders.map((item) => {
        const time = clock.format(new Date(item.start_at));
        return <div className="reminder-row" key={item.id}>
          <div><strong>{time} · {item.patient_name}</strong><small>{item.service_name}{item.doctor_name ? ` · ${item.doctor_name}` : ""}</small></div>
          <WhatsappReminderButton clinicId={clinicId} appointmentId={item.id} phone={item.patient_phone} template={template} variables={{
            patient_first_name: item.patient_name.trim().split(/\s+/)[0] || item.patient_name,
            patient_name: item.patient_name, date: formatRomanianDate(date), time,
            service_name: item.service_name, doctor_name: item.doctor_name || "",
            clinic_name: clinicName, clinic_address: clinicAddress, clinic_phone: clinicPhone,
          }} />
        </div>;
      })}
      {!reminders.length && <p className="table-empty"><T>{"Nu există remindere eligibile pentru mâine."}</T></p>}
    </div>
  </Panel>;
}
