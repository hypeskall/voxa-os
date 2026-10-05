import Link from "next/link";
import { can, type Permission } from "@/lib/permissions";
import { requireClinic } from "@/features/auth/access";
import { PageHeading, Section, Table } from "@/components/ui/page";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import {
  moduleSpecs,
  modulePermission,
  valueIds,
  valueText,
  type CoreModule,
} from "./model";
import { readCore, editorOptions, patientHistory, listCore } from "./data";
import { CoreEditor } from "./editor";
import { CoreCreatePanel } from "./create-panel";
import { archiveCoreAction } from "./actions";
import { formatInTimeZone } from "@/lib/time";
import { PatientDocuments } from "@/features/documents/patient-documents";
import { PatientResults } from "@/features/results/patient-results";
import { DoctorCredentials } from "@/features/credentials/doctor-credentials";
import { ActivatePatientPortal } from "@/features/patient-portal/activate-portal";
import { PatientAppointments, PatientCommunications } from "@/features/patient-portal/patient-activity";
import { PatientNotes } from "@/features/privacy/patient-notes";
import { PatientPrivacy } from "@/features/privacy/patient-privacy";
export async function CoreDetail({
  cid,
  module,
  id,
  tab = "overview",
}: {
  cid: string;
  module: CoreModule;
  id: string;
  tab?: string;
}) {
  const { clinic, permissions } = await requireClinic(
    cid,
    modulePermission(module, "read"),
  );
  const row = await readCore(cid, module, id);
  const manage = can(permissions, modulePermission(module, "manage"));
  const options = await editorOptions(cid, module, row);
  const spec = moduleSpecs[module];
  const patientTabs = [
    ["overview", "Prezentare"],
    ["appointments", "Programări"],
    ["documents", "Documente"],
    ["results", "Rezultate"],
    ["communications", "Comunicări"],
    ["history", "Istoric"],
  ];
  const tabPermissions: Record<string, Permission> = {
    appointments: "appointments.read", documents: "documents.read",
    results: "results.read", communications: "notifications.read",
  };
  const doctorTabs = [["details", "Detalii"], ["services", "Servicii"], ["schedule", "Program"], ["unavailability", "Indisponibilități"]];
  const serviceTabs = [["general", "General"], ["doctors", "Medici"], ["resources", "Resurse"], ["preparation", "Pregătire și documente"], ["scheduling", "Programare"]];
  const tabs = module === "patients" ? patientTabs : module === "doctors" ? doctorTabs : module === "services" ? serviceTabs : [];
  const defaultTab = module === "doctors" ? "details" : module === "services" ? "general" : "overview";
  const activeTab = tabs.some(([key]) => key === tab) ? tab : defaultTab;
  const deniedTab = module === "patients" && tabPermissions[activeTab] && !can(permissions, tabPermissions[activeTab]);
  const history =
    module === "patients" && activeTab === "history"
      ? await patientHistory(cid, id)
      : [];
  const resourceKind = {
    doctors: "doctor",
    rooms: "room",
    equipment: "equipment",
  }[module as "doctors" | "rooms" | "equipment"];
  const scheduleModule = activeTab === "schedule" ? "availability" : activeTab === "unavailability" ? "exceptions" : null;
  const scheduleRows = module === "doctors" && scheduleModule
    ? await listCore(cid, scheduleModule, { state: "all", filter_id: id })
    : null;
  const scheduleOptions = module === "doctors" && scheduleModule && manage
    ? await editorOptions(cid, scheduleModule)
    : {};
  const fieldGroups: Record<string, string[]> = {
    details: ["professional_code", "phone", "email"],
    services: ["speciality_ids", "service_ids", "room_ids"],
    general: ["category_id", "price"],
    doctors: ["doctor_ids"],
    resources: ["room_ids", "equipment_ids", "room_required", "minimum_room_capacity"],
    preparation: ["instructions", "required_documents", "exclusion_rules"],
    scheduling: ["duration_minutes", "buffer_before", "buffer_after", "doctor_requirement"],
  };
  const visibleFieldKeys = fieldGroups[activeTab];
  return (
    <>
      <Link className="text-link" href={module === "rooms" || module === "equipment" ? `/clinics/${cid}/resources?tab=${module}` : module === "availability" || module === "exceptions" ? `/clinics/${cid}/availability?tab=${module === "exceptions" ? "exceptions" : "clinic"}` : `/clinics/${cid}/${module}`}>
        Înapoi la {spec.title.toLocaleLowerCase("ro")}
      </Link>
      <div className="mt-6">
        <PageHeading
          eyebrow={spec.singular}
          title={row.name}
          description={`${clinic.name} · ${row.archived_at ? "Arhivat" : row.active ? "Activ" : "Inactiv"}`}
          action={
            manage && !row.archived_at ? (
              <Panel
                key={row.updated_at}
                drawer
                title={`Editează ${spec.singular.toLocaleLowerCase("ro")}`}
                description="Modificările sunt verificate și salvate pe server."
                trigger={<Button>Editează</Button>}
              >
                <CoreEditor
                  cid={cid}
                  module={module}
                  row={row}
                  options={options}
                  timeZone={clinic.timezone}
                />
              </Panel>
            ) : undefined
          }
        />
      </div>
      {tabs.length > 0 && (
        <nav className="profile-tabs" aria-label={module === "patients" ? "Secțiuni profil pacient" : "Secțiuni configurare"}>
          {tabs.filter(([key]) => module !== "patients" || !tabPermissions[key] || can(permissions, tabPermissions[key])).map(([key, label]) => (
            <Link
              key={key}
              aria-current={activeTab === key ? "page" : undefined}
              className={activeTab === key ? "selected" : ""}
              href={`?tab=${key}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {deniedTab ? (
        <Section title={tabs.find(([key]) => key === activeTab)?.[1] ?? "Acces restricționat"}>
          <p className="muted">Rolul dumneavoastră nu permite accesul la această secțiune.</p>
        </Section>
      ) : module !== "patients" || activeTab === "overview" ? (
        <>
          {!(module === "doctors" && scheduleModule) && <Section
            title={module === "patients" ? "Date administrative" : tabs.find(([key]) => key === activeTab)?.[1] ?? "Detalii"}
          >
            <dl className="record-details">
              {spec.fields.map((field) => {
                if (field.key === "name") return null;
                if (visibleFieldKeys && !visibleFieldKeys.includes(field.key)) return null;
                if (
                  (module === "availability" || module === "exceptions") &&
                  ["doctor_location_id", "room_id", "equipment_id"].includes(
                    field.key,
                  ) &&
                  !valueText(row, field.key)
                )
                  return null;
                let text = valueText(row, field.key);
                if (field.source) {
                  const ids =
                    field.kind === "multiple"
                      ? valueIds(row, field.key)
                      : [text];
                  text = (options[field.key] ?? [])
                    .filter((o) => ids.includes(o.id))
                    .map(
                      (o) => o.name + (!o.active ? " (inactiv / arhivat)" : ""),
                    )
                    .join(", ");
                } else if (field.kind === "lines")
                  text = valueIds(row, field.key).join("\n");
                else if (field.options)
                  text = field.options.find(([v]) => v === text)?.[1] ?? text;
                else if (typeof row[field.key] === "boolean")
                  text = row[field.key] ? "Da" : "Nu";
                else if (field.kind === "datetime" && text)
                  text = formatInTimeZone(text, clinic.timezone);
                return (
                  <div
                    key={field.key}
                    className={
                      field.kind === "textarea" || field.kind === "lines"
                        ? "wide-detail"
                        : ""
                    }
                  >
                    <dt>{field.label}</dt>
                    <dd>{text || "Necompletat"}</dd>
                  </div>
                );
              })}
            </dl>
          </Section>}
          {resourceKind && module !== "doctors" && (
            <Section
              title="Program și indisponibilități"
              description={`Configurare pentru această resursă, în fusul ${clinic.timezone}.`}
            >
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" asChild>
                  <Link href={`/clinics/${cid}/availability?tab=${resourceKind === "doctor" ? "doctors" : "clinic"}${resourceKind === "doctor" ? `&doctor=${id}` : ""}`}>
                    Vezi programul de lucru
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/clinics/${cid}/availability?tab=exceptions&resource=${id}&kind=${resourceKind}`}>
                    Blocări și excepții
                  </Link>
                </Button>
              </div>
            </Section>
          )}
          {module === "patients" && <><PatientNotes cid={cid} pid={id}/>{can(permissions,"organization.manage")&&<PatientPrivacy cid={cid} pid={id}/>}<ActivatePatientPortal cid={cid} pid={id} /></>}
          {module === "doctors" && activeTab === "details" && (
            <DoctorCredentials cid={cid} did={id} />
          )}
          {module === "doctors" && scheduleModule && scheduleRows && (
            <Section
              title={scheduleModule === "availability" ? "Program săptămânal" : "Indisponibilități"}
              description={scheduleModule === "availability" ? "Intervalele recurente ale medicului." : "Concedii și blocări care scad disponibilitatea medicului."}
            >
              {manage && <div className="mb-5"><CoreCreatePanel cid={cid} module={scheduleModule} options={scheduleOptions} timeZone={clinic.timezone} label={scheduleModule === "availability" ? "Adaugă interval" : "Adaugă indisponibilitate"} preset={{ kind: "doctor", id }} /></div>}
              <Table>
                <thead><tr><th>Denumire</th><th>{scheduleModule === "availability" ? "Zi / interval" : "Perioadă"}</th><th>Tip</th><th></th></tr></thead>
                <tbody>
                  {scheduleRows.items.map((item) => <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{scheduleModule === "availability" ? `${["", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"][Number(item.weekday)]} · ${valueText(item, "start_time").slice(0, 5)}–${valueText(item, "end_time").slice(0, 5)}` : `${formatInTimeZone(valueText(item, "starts_at"), clinic.timezone)} – ${formatInTimeZone(valueText(item, "ends_at"), clinic.timezone)}`}</td>
                    <td>{moduleSpecs[scheduleModule].fields.find(field => field.key === (scheduleModule === "availability" ? "interval_kind" : "exception_kind"))?.options?.find(([key]) => key === valueText(item, scheduleModule === "availability" ? "interval_kind" : "exception_kind"))?.[1] ?? "Necompletat"}</td>
                    <td><Link className="text-link" href={`/clinics/${cid}/${scheduleModule}/${item.id}`}>Editează</Link></td>
                  </tr>)}
                  {!scheduleRows.items.length && <tr><td colSpan={4} className="table-empty">Nu există intervale configurate.</td></tr>}
                </tbody>
              </Table>
            </Section>
          )}
        </>
      ) : activeTab === "documents" ? (
        <PatientDocuments cid={cid} pid={id} />
      ) : activeTab === "results" ? (
        <PatientResults cid={cid} pid={id} />
      ) : activeTab === "appointments" ? (
        <PatientAppointments cid={cid} pid={id} />
      ) : activeTab === "communications" ? (
        <PatientCommunications cid={cid} pid={id} />
      ) : activeTab === "history" ? (
        <Section
          title="Istoric administrativ"
          description="Ultimele 100 de evenimente. Valorile datelor personale nu sunt copiate în jurnal."
        >
          <Table>
            <thead>
              <tr>
                <th>Dată și oră</th>
                <th>Acțiune</th>
                <th>Câmpuri modificate</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={`${h.created_at}-${i}`}>
                  <td>{formatInTimeZone(h.created_at, clinic.timezone)}</td>
                  <td>
                    {{
                      insert: "Creare",
                      update: "Modificare",
                      archive: "Arhivare",
                    }[h.action] ?? h.action}
                  </td>
                  <td>
                    {Array.isArray(h.metadata.fields)
                      ? h.metadata.fields
                          .map(
                            (k) =>
                              spec.fields.find((f) => f.key === k)?.label ??
                              (k === "active"
                                ? "Stare"
                                : k === "archived_at"
                                  ? "Arhivare"
                                  : ""),
                          )
                          .filter(Boolean)
                          .join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
              {!history.length && (
                <tr>
                  <td colSpan={3} className="table-empty">
                    Nu există evenimente înregistrate.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Section>
      ) : (
        <section className="empty-module">
          <h2>{tabs.find(([key]) => key === activeTab)?.[1]}</h2>
          <p className="muted">
            Acest modul nu este încă activ. Aici vor apărea înregistrările reale
            ale pacientului după implementarea etapei corespunzătoare.
          </p>
        </section>
      )}
      {manage && (
        <Section
          title={row.archived_at ? "Restaurare" : "Arhivare"}
          description={
            row.archived_at
              ? "Înregistrarea poate fi readusă în registrul activ."
              : "Arhivarea păstrează datele și istoricul. Înregistrarea nu va mai fi disponibilă pentru selecții noi."
          }
        >
          <Panel
            title={
              row.archived_at
                ? "Restaurează înregistrarea"
                : "Confirmă arhivarea"
            }
            description={
              row.archived_at
                ? "Înregistrarea va redeveni activă în această clinică."
                : `Arhivați „${row.name}” în clinică? Istoricul este păstrat.`
            }
            trigger={
              <Button variant="outline">
                {row.archived_at ? "Restaurează" : "Arhivează"}
              </Button>
            }
          >
            <ActionForm
              action={archiveCoreAction.bind(
                null,
                cid,
                module,
                id,
                !!row.archived_at,
              )}
              submit={
                row.archived_at ? "Confirmă restaurarea" : "Confirmă arhivarea"
              }
            >
              <p className="muted">
                Operația se aplică acestei clinici.
              </p>
            </ActionForm>
          </Panel>
        </Section>
      )}
    </>
  );
}
