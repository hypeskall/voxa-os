import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { requireClinic, workspace } from "@/features/auth/access";
import { PageHeading, Section, Table } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { loadOperationalDashboard } from "@/features/dashboard/data";
import { LiveRefresh } from "@/components/live-refresh";
import { localDate, formatInTimeZone } from "@/lib/time";
import { appointmentStatusLabels, formatRomanianDate } from "@/lib/locale/ro";
import { WhatsappReminderButton } from "@/features/calendar/whatsapp-reminder-button";

const eventLabels: Record<string, string> = {
  CREATED: "Programare creată", UPDATED: "Programare actualizată",
  RESCHEDULED: "Programare reprogramată", CANCELLED: "Programare anulată",
  STATUS_CHANGED: "Status actualizat", RESOURCES_ASSIGNED: "Resurse alocate",
  DUPLICATE_OVERRIDE: "Avertisment confirmat",
};

export default async function Overview({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const { clinic, client } = await requireClinic(clinicId);
  const { preferences } = await workspace();
  const { data: org, error } = await client
    .from("organizations")
    .select("name")
    .eq("id", clinic.organization_id)
    .single();
  if (error) throw new Error("Organizația nu a putut fi încărcată.");
  const dashboard = await loadOperationalDashboard(clinicId, localDate(clinic.timezone));
  const enabled = new Set(preferences?.dashboard_modules ?? ["metrics", "upcoming", "alerts", "activity"]);
  return (
    <>
      <LiveRefresh />
      <PageHeading
        eyebrow={org.name}
        title="Spațiul de lucru"
        description={`Situația operațională pentru ${new Intl.DateTimeFormat("ro-RO", { dateStyle: "long", timeZone: clinic.timezone }).format(new Date())}.`}
        action={
          <Button asChild variant="outline">
            <Link href={`/clinics/${clinicId}/settings`}>
              Setări dashboard
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        }
      />
      {!dashboard.can_view_schedule ? (
        <Section title={clinic.name} description={org.name}>
          <div className="empty-module"><CalendarDays size={22} /><h2>Acces operațional restricționat</h2><p className="muted">Rolul curent nu include vizualizarea programărilor. Registrele permise rămân disponibile din meniu.</p></div>
        </Section>
      ) : (
        <>
          {enabled.has("metrics") && <div className="metric-strip" aria-label="Indicatori zilnici">
            <div><span>Programări</span><strong>{dashboard.metrics.appointments ?? 0}</strong></div>
            <div><span>Confirmate</span><strong>{dashboard.metrics.confirmed ?? 0}</strong></div>
            <div><span>În așteptare</span><strong>{dashboard.metrics.pending ?? 0}</strong></div>
            <div><span>Finalizate</span><strong>{dashboard.metrics.completed ?? 0}</strong></div>
            <div><span>Ocupare program</span><strong>{dashboard.metrics.occupancy_percent == null ? "—" : `${dashboard.metrics.occupancy_percent}%`}</strong></div>
          </div>}
          <div className="operations-grid">
            {enabled.has("upcoming") && <Section title="Programări astăzi" description="Toate programările de astăzi, sincronizate cu calendarul.">
              <Table><thead><tr><th>Ora</th><th>Pacient</th><th>Serviciu</th><th>Medic / cabinet</th><th>Status</th></tr></thead><tbody>
                {dashboard.upcoming.map((item) => <tr key={item.id}>
                  <td><Link className="row-link" href={`/clinics/${clinicId}/calendar?date=${dashboard.date}&appointment=${item.id}`}>{new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: clinic.timezone }).format(new Date(item.start_at))}</Link></td>
                  <td><Link className="row-link" href={`/clinics/${clinicId}/patients/${item.patient_id}`}>{item.patient_name}</Link></td><td>{item.service_name}</td><td>{[item.doctor_name,item.room_name].filter(Boolean).join(" · ") || "Nealocat"}</td><td><span className={`appointment-status status-${item.status.toLowerCase()}`}>{appointmentStatusLabels[item.status] ?? item.status}</span></td>
                </tr>)}
                {!dashboard.upcoming.length && <tr><td colSpan={5} className="table-empty">Nu există programări pentru astăzi.</td></tr>}
              </tbody></Table>
            </Section>}
            {enabled.has("alerts") && <Section title="Atenție necesară" description="Situații care pot necesita intervenție.">
              <div className="alert-list">{dashboard.alerts.map((alert) => <div className={`alert-row ${alert.tone}`} key={alert.code}><span>{alert.label}</span><strong>{alert.count}</strong></div>)}</div>
            </Section>}
            {enabled.has("upcoming") && <Section title="Remindere pentru mâine" description="Programări active cu număr de telefon disponibil.">
              <div className="reminder-list">{dashboard.tomorrow_reminders.map((item) => { const localDate=new Intl.DateTimeFormat("sv-SE",{timeZone:clinic.timezone}).format(new Date(item.start_at)); const time=new Intl.DateTimeFormat("ro-RO",{timeZone:clinic.timezone,hour:"2-digit",minute:"2-digit"}).format(new Date(item.start_at)); return <div className="reminder-row" key={item.id}><div><strong>{time} · {item.patient_name}</strong><small>{item.service_name}{item.doctor_name?` · ${item.doctor_name}`:""}</small></div><WhatsappReminderButton clinicId={clinicId} appointmentId={item.id} phone={item.patient_phone} template={clinic.whatsapp_reminder_template} recommended variables={{patient_first_name:item.patient_name.trim().split(/\s+/)[0]||item.patient_name,patient_name:item.patient_name,date:formatRomanianDate(localDate),time,service_name:item.service_name,doctor_name:item.doctor_name||"",clinic_name:clinic.name,clinic_address:clinic.address,clinic_phone:clinic.phone}} /></div>; })}{!dashboard.tomorrow_reminders.length&&<p className="table-empty">Nu există remindere eligibile pentru mâine.</p>}</div>
            </Section>}
          </div>
          {enabled.has("activity") && <Section title="Activitate recentă" description="Evenimentele operaționale de astăzi.">
            <div className="activity-list">{dashboard.activity.map((item) => <div key={item.id}><span className="activity-time">{formatInTimeZone(item.created_at, clinic.timezone)}</span><strong>{eventLabels[item.event] ?? item.event}</strong><span>{item.patient_name} · {item.actor_name}</span></div>)}{!dashboard.activity.length && <p className="table-empty">Nu există activitate înregistrată astăzi.</p>}</div>
          </Section>}
        </>
      )}
    </>
  );
}
