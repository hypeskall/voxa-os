import { T, LocalizedElement, LocaleMessage } from "@/components/locale-provider";
import Link from "next/link";
import { z } from "zod";
import { CalendarClock, CalendarOff, Stethoscope } from "lucide-react";
import { can } from "@/lib/permissions";
import { requireClinic } from "@/features/auth/access";
import { editorOptions, listCore, optionsFor } from "@/features/core-clinic/data";
import { valueText, type CoreRow } from "@/features/core-clinic/model";
import { Registry } from "@/features/core-clinic/registry";
import { CoreCreatePanel } from "@/features/core-clinic/create-panel";
import { saveClinicScheduleAction } from "@/features/availability/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { PageHeading, Section, Table } from "@/components/ui/page";

export const metadata = { title: "Disponibilitate" };

const days = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

function normalizedTime(value: string, fallback: string) {
  return value ? value.slice(0, 5) : fallback;
}

function ruleFor(rows: CoreRow[], weekday: number) {
  return rows.find((row) => Number(row.weekday) === weekday && row.resource_kind === "clinic" && row.interval_kind === "work" && row.active);
}

export default async function AvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>;
  searchParams: Promise<{ tab?: string; doctor?: string }>;
}) {
  const { clinicId } = await params;
  const query = await searchParams;
  const tab = query.tab === "doctors" || query.tab === "exceptions" ? query.tab : "clinic";
  const context = await requireClinic(clinicId, "availability.read");
  const manage = can(context.permissions, "availability.manage");
  const doctorId = z.uuid().safeParse(query.doctor).success ? String(query.doctor) : null;
  const [clinicList, doctors, availabilityOptions, exceptionOptions] = await Promise.all([
    listCore(clinicId, "availability", { state: "all", filter_id: clinicId }),
    optionsFor(clinicId, "doctors"),
    manage ? editorOptions(clinicId, "availability") : {},
    manage ? editorOptions(clinicId, "exceptions") : {},
  ]);
  const selectedDoctor = doctorId ?? doctors[0]?.id ?? null;
  const [doctorList, exceptionList] = await Promise.all([
    selectedDoctor ? listCore(clinicId, "availability", { state: "all", filter_id: selectedDoctor }) : Promise.resolve({ items: [], total: 0 }),
    listCore(clinicId, "exceptions", { state: "active" }),
  ]);
  const clinicRules = clinicList.items.filter((row) => row.resource_kind === "clinic" && row.interval_kind === "work" && row.active && !row.archived_at);
  return (
    <>
      <PageHeading
        eyebrow={context.clinic.name}
        title="Disponibilitate"
        description="Programul clinicii, intervalele medicilor și indisponibilitățile care limitează programarea."
        action={tab === "exceptions" && manage ? <CoreCreatePanel cid={clinicId} module="exceptions" options={exceptionOptions} timeZone={context.clinic.timezone} label="Adaugă indisponibilitate" /> : undefined}
      />
      <LocalizedElement as="nav" className="module-tabs" aria-label="Secțiuni disponibilitate">
        <Link href="?tab=clinic" className={tab === "clinic" ? "selected" : ""}><CalendarClock size={16}/><T>{"Program clinică"}</T></Link>
        <Link href={`?tab=doctors${selectedDoctor ? `&doctor=${selectedDoctor}` : ""}`} className={tab === "doctors" ? "selected" : ""}><Stethoscope size={16}/><T>{"Program medici"}</T></Link>
        <Link href="?tab=exceptions" className={tab === "exceptions" ? "selected" : ""}><CalendarOff size={16}/><T>{"Indisponibilități"}</T></Link>
      </LocalizedElement>

      {tab === "clinic" && (
        <Section title="Program general" description="Acest program este folosit de motorul de disponibilitate pentru toate rezervările.">
          <div className="weekly-schedule">
            {days.map((day, index) => {
              const rule = ruleFor(clinicRules, index + 1);
              return <div key={day}><span>{day}</span>{rule ? <strong>{normalizedTime(valueText(rule,"start_time"),"08:00")} – {normalizedTime(valueText(rule,"end_time"),"20:00")}</strong> : <strong className="closed"><T>{"Închis"}</T></strong>}</div>;
            })}
          </div>
          {manage && (
            <Panel
              title="Modifică programul clinicii"
              description="Intervalele sunt salvate atomic și se aplică imediat disponibilității."
              trigger={<Button variant="outline"><T>{"Modifică programul"}</T></Button>}
            >
              <ActionForm action={saveClinicScheduleAction.bind(null, clinicId)} submit="Salvează programul">
                <div className="schedule-editor">
                  {days.map((day, index) => {
                    const rule = ruleFor(clinicRules, index + 1);
                    return <div className="schedule-editor-row" key={day}>
                      <label><input type="checkbox" name={`day_${index + 1}_open`} defaultChecked={!!rule}/><span>{day}</span></label>
                      <Input aria-label={`${day} început`} name={`day_${index + 1}_start`} type="time" defaultValue={normalizedTime(valueText(rule,"start_time"),"08:00")} />
                      <span>–</span>
                      <Input aria-label={`${day} sfârșit`} name={`day_${index + 1}_end`} type="time" defaultValue={normalizedTime(valueText(rule,"end_time"),"20:00")} />
                    </div>;
                  })}
                </div>
              </ActionForm>
            </Panel>
          )}
        </Section>
      )}

      {tab === "doctors" && (
        <>
          <div className="availability-doctor-picker">
            <form method="get">
              <input type="hidden" name="tab" value="doctors" />
              <label htmlFor="doctor"><T>{"Medic"}</T></label>
              <Select id="doctor" name="doctor" defaultValue={selectedDoctor ?? ""}>
                {!doctors.length && <option value=""><T>{"Nu există medici configurați"}</T></option>}
                {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
              </Select>
              <Button type="submit" variant="outline"><T>{"Afișează programul"}</T></Button>
            </form>
            {selectedDoctor && manage && <CoreCreatePanel cid={clinicId} module="availability" options={availabilityOptions} timeZone={context.clinic.timezone} label="Adaugă interval" preset={{ kind: "doctor", id: selectedDoctor }} />}
          </div>
          <Section title={doctors.find((doctor) => doctor.id === selectedDoctor)?.name ?? "Program medic"} description="Intervalele săptămânale configurate pentru medicul selectat.">
            <Table><thead><tr><th><T>{"Zi"}</T></th><th><T>{"Interval"}</T></th><th><T>{"Tip"}</T></th><th><T>{"Valabilitate"}</T></th><th></th></tr></thead><tbody>
              {doctorList.items.map((row) => <tr key={row.id}><td>{days[Number(row.weekday)-1]}</td><td><strong>{valueText(row,"start_time").slice(0,5)} – {valueText(row,"end_time").slice(0,5)}</strong></td><td><T>{row.interval_kind === "break" ? "Pauză" : "Lucru"}</T></td><td>{valueText(row,"valid_from")}<T>{row.valid_until ? <LocaleMessage template={" – {0}"} values={[valueText(row,"valid_until")]} /> : ""}</T></td><td><Link className="text-link" href={`/clinics/${clinicId}/availability/${row.id}`}><T>{"Editează"}</T></Link></td></tr>)}
              {!doctorList.items.length && <tr><td colSpan={5}><div className="action-empty"><div><strong><T>{"Medicul nu are program configurat."}</T></strong><p><T>{"Adăugați primul interval săptămânal."}</T></p></div>{selectedDoctor && manage ? <CoreCreatePanel cid={clinicId} module="availability" options={availabilityOptions} timeZone={context.clinic.timezone} variant="outline" label="Adaugă interval" preset={{ kind: "doctor", id: selectedDoctor }} /> : undefined}</div></td></tr>}
            </tbody></Table>
          </Section>
        </>
      )}

      {tab === "exceptions" && (
        <>
          <div className="resource-context"><div><strong><T>{"Blocări operaționale"}</T></strong><span><T>{"Concedii, mentenanță, cabinet indisponibil sau închidere excepțională."}</T></span></div></div>
          <Registry cid={clinicId} module="exceptions" initial={exceptionList} timeZone={context.clinic.timezone} emptyAction={manage ? <CoreCreatePanel cid={clinicId} module="exceptions" options={exceptionOptions} timeZone={context.clinic.timezone} variant="outline" label="Adaugă prima indisponibilitate" /> : undefined} />
        </>
      )}
    </>
  );
}
