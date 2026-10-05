import { T } from "@/components/locale-provider";
import { requireClinic } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import { PageHeading, Section, Table } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { saveNotificationSettings, saveTemplate } from "@/features/notifications/actions";
import { formatInTimeZone } from "@/lib/time";
import { notificationEventLabels, notificationStatusLabels } from "@/lib/locale/ro";

export default async function NotificationsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params;
  const { client, clinic, permissions } = await requireClinic(clinicId, "notifications.read");
  const [settingsResponse, templatesResponse, logsResponse] = await Promise.all([
    client.from("clinic_notification_settings").select("*").eq("clinic_id", clinicId).single(),
    client.from("communication_templates").select("*").eq("clinic_id", clinicId).order("event").order("channel"),
    client.from("communication_logs").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (settingsResponse.error || templatesResponse.error || logsResponse.error) throw new Error("Comunicările nu au putut fi citite.");
  const settings = settingsResponse.data;
  const templates = templatesResponse.data;
  const logs = logsResponse.data;
  const manage = can(permissions, "notifications.manage");
  const activeDelivery = process.env.NOTIFICATION_DELIVERY_ENABLED === "true";
  const smsAvailable = process.env.NOTIFICATION_PROVIDER === "webhook";
  return <><PageHeading eyebrow={clinic.name} title="Comunicări" description="Confirmări, șabloane, remindere și starea livrărilor."/>
    {!activeDelivery && <p className="message" role="status"><T>{"Trimiterea automată către pacienți nu este activată. Setările și șabloanele pot fi pregătite; mesajele nu sunt trimise automat."}</T></p>}
    {settings && <Section title="Politici și remindere" description="Jobul verifică mesajele la fiecare cinci minute. Reamintirile se trimit între 08:00 și 20:00, în fusul clinicii. Cele care ar cădea noaptea se programează la 19:55, în seara anterioară momentului calculat. Confirmările și celelalte mesaje se trimit la momentul evenimentului.">
      {manage ? <ActionForm action={saveNotificationSettings.bind(null, clinicId)}>
        <div className="form-grid"><Field label="Expirare link confirmare (ore)"><Input name="confirmation_expiry_hours" type="number" defaultValue={settings.confirmation_expiry_hours}/></Field><Field label="Termen minim anulare (ore)"><Input name="cancellation_min_notice_hours" type="number" defaultValue={settings.cancellation_min_notice_hours}/></Field></div>
        <fieldset className="check-group"><legend><T>{"Canale"}</T></legend><label><input name="email_enabled" type="checkbox" defaultChecked={settings.email_enabled}/><T>{" Email"}</T></label><label><input name="sms_enabled" type="checkbox" defaultChecked={settings.sms_enabled && smsAvailable} disabled={!smsAvailable}/><T>{" SMS"}</T>{!smsAvailable && " · indisponibil"}</label></fieldset>
        <fieldset className="check-group"><legend><T>{"Reamintiri"}</T></legend>{[[2880,"48 ore"],[1440,"24 ore"],[120,"2 ore"]] .map(([value,label]) => <label key={value}><input name="reminders" value={value} type="checkbox" defaultChecked={settings.reminder_offsets_minutes.includes(Number(value))}/><T>{label}</T></label>)}</fieldset>
      </ActionForm> : <p className="muted"><T>{"Configurarea este disponibilă administratorilor clinicii."}</T></p>}
    </Section>}
    <Section title="Șabloane" description="Variabile disponibile: {{clinic_name}}, {{service_name}}, {{date}}, {{time}}, {{confirmation_url}}, {{portal_url}}.">
      <div className="template-list">{templates?.map(template => <details key={template.id}><summary><T>{notificationEventLabels[template.event] ?? template.event}</T> · <T>{template.channel === "EMAIL" ? "Email" : "SMS"}</T></summary>{manage ? <ActionForm action={saveTemplate.bind(null, clinicId, template.id)}><Field label="Subiect"><Input name="subject" defaultValue={template.subject}/></Field><Field label="Mesaj"><textarea className="input textarea" name="body" defaultValue={template.body}/></Field><label className="checkbox-line"><input name="active" type="checkbox" defaultChecked={template.active}/><T>{" Șablon activ"}</T></label></ActionForm> : <div><p><strong>{template.subject}</strong></p><p style={{ whiteSpace: "pre-wrap" }}><T>{template.body}</T></p><p className="muted"><T>{template.active ? "Șablon activ" : "Șablon inactiv"}</T></p></div>}</details>)}</div>
    </Section>
    <Section title="Jurnal livrări"><Table><thead><tr><th><T>{"Dată"}</T></th><th><T>{"Eveniment"}</T></th><th><T>{"Canal"}</T></th><th><T>{"Destinatar"}</T></th><th><T>{"Stare"}</T></th><th><T>{"Încercări"}</T></th></tr></thead><tbody>{logs?.map(log => <tr key={log.id}><td>{formatInTimeZone(log.created_at, clinic.timezone)}</td><td><T>{notificationEventLabels[log.event] ?? log.event}</T></td><td><T>{log.channel === "EMAIL" ? "Email" : "SMS"}</T></td><td>{log.recipient_masked}</td><td><span className="status"><T>{notificationStatusLabels[log.status] ?? log.status}</T></span></td><td>{log.attempts}</td></tr>)}{!logs?.length && <tr><td colSpan={6} className="table-empty"><T>{"Nu există livrări înregistrate."}</T></td></tr>}</tbody></Table></Section>
  </>;
}
