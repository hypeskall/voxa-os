import { requireClinic } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import { PageHeading, Section, Table } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { saveNotificationSettings, saveTemplate } from "@/features/notifications/actions";
import { formatInTimeZone } from "@/lib/time";

const eventLabels: Record<string,string> = { APPOINTMENT_CREATED: "Programare creată", CONFIRMATION_REQUESTED: "Solicitare confirmare", APPOINTMENT_CONFIRMED: "Confirmare", APPOINTMENT_CHANGED: "Modificare", APPOINTMENT_CANCELLED: "Anulare", APPOINTMENT_REMINDER: "Reamintire", RESULT_AVAILABLE: "Rezultat disponibil" };
export default async function NotificationsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params;
  const { client, clinic, permissions } = await requireClinic(clinicId, "notifications.read");
  const [{ data: settings }, { data: templates }, { data: logs }] = await Promise.all([
    client.from("clinic_notification_settings").select("*").eq("clinic_id", clinicId).single(),
    client.from("communication_templates").select("*").eq("clinic_id", clinicId).order("event").order("channel"),
    client.from("communication_logs").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(100),
  ]);
  const manage = can(permissions, "notifications.manage");
  return <><PageHeading eyebrow={clinic.name} title="Comunicări" description="Confirmări, șabloane, remindere și starea livrărilor."/>
    {settings && <Section title="Politici și remindere" description="Jobul programat verifică mesajele datorate la fiecare cinci minute.">
      {manage ? <ActionForm action={saveNotificationSettings.bind(null, clinicId)}>
        <div className="form-grid"><Field label="Expirare link confirmare (ore)"><Input name="confirmation_expiry_hours" type="number" defaultValue={settings.confirmation_expiry_hours}/></Field><Field label="Termen minim anulare (ore)"><Input name="cancellation_min_notice_hours" type="number" defaultValue={settings.cancellation_min_notice_hours}/></Field></div>
        <fieldset className="check-group"><legend>Canale</legend><label><input name="email_enabled" type="checkbox" defaultChecked={settings.email_enabled}/> Email</label><label><input name="sms_enabled" type="checkbox" defaultChecked={settings.sms_enabled}/> SMS</label></fieldset>
        <fieldset className="check-group"><legend>Reamintiri</legend>{[[2880,"48 ore"],[1440,"24 ore"],[120,"2 ore"]] .map(([value,label]) => <label key={value}><input name="reminders" value={value} type="checkbox" defaultChecked={settings.reminder_offsets_minutes.includes(Number(value))}/>{label}</label>)}</fieldset>
      </ActionForm> : <p className="muted">Configurarea este disponibilă administratorilor clinicii.</p>}
    </Section>}
    <Section title="Șabloane" description="Variabile disponibile: {{clinic_name}}, {{service_name}}, {{date}}, {{time}}, {{confirmation_url}}, {{portal_url}}.">
      <div className="template-list">{templates?.map(template => <details key={template.id}><summary>{eventLabels[template.event] ?? template.event} · {template.channel}</summary><ActionForm action={saveTemplate.bind(null, clinicId, template.id)}><Field label="Subiect"><Input name="subject" defaultValue={template.subject}/></Field><Field label="Mesaj"><textarea className="input textarea" name="body" defaultValue={template.body}/></Field><label className="checkbox-line"><input name="active" type="checkbox" defaultChecked={template.active}/> Șablon activ</label></ActionForm></details>)}</div>
    </Section>
    <Section title="Jurnal livrări"><Table><thead><tr><th>Dată</th><th>Eveniment</th><th>Canal</th><th>Destinatar</th><th>Stare</th><th>Încercări</th></tr></thead><tbody>{logs?.map(log => <tr key={log.id}><td>{formatInTimeZone(log.created_at, clinic.timezone)}</td><td>{eventLabels[log.event] ?? log.event}</td><td>{log.channel}</td><td>{log.recipient_masked}</td><td><span className="status">{log.status}</span></td><td>{log.attempts}</td></tr>)}{!logs?.length && <tr><td colSpan={6} className="table-empty">Nu există livrări înregistrate.</td></tr>}</tbody></Table></Section>
  </>;
}
