import Link from "next/link";
import { T, LocaleDate } from "@/components/locale-provider";
import { requireClinic } from "@/features/auth/access";
import { optionsFor } from "@/features/core-clinic/data";
import { PageHeading, Table } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { ActionForm } from "@/components/ui/action-form";
import { workspaceSchema, workLabels } from "./model";
import { WorkForm } from "./work-form";
import { SlotOffer } from "./slot-offer";
import { bookOffer } from "./actions";
export async function ReceptionWorkspace({
  cid,
  kind,
  all = false,
}: {
  cid: string;
  kind: "TASK" | "WAITLIST";
  all?: boolean;
}) {
  const { client, clinic } = await requireClinic(cid, "appointments.manage");
  const { data, error } = await client.rpc("reception_workspace", {
    cid,
    work_kind: kind,
    work_status: all ? "ALL" : "ACTIVE",
  });
  if (error) throw new Error("Lista recepției nu a putut fi încărcată.");
  const work = workspaceSchema.parse(data);
  const selected = (key: "patient_id" | "service_id" | "doctor_id") =>
    work.items.flatMap((item) => (item[key] ? [item[key]!] : []));
  const [patients, services, doctors] = await Promise.all([
    optionsFor(cid, "patients", selected("patient_id")),
    optionsFor(cid, "services", selected("service_id")),
    optionsFor(cid, "doctors", selected("doctor_id")),
  ]);
  const options = { patients, services, doctors };
  const title = kind === "TASK" ? "Taskuri recepție" : "Listă de așteptare";
  const path = kind === "TASK" ? "tasks" : "waitlist";
  return (
    <>
      <PageHeading
        eyebrow={clinic.name}
        title={title}
        description={
          kind === "TASK"
            ? "Responsabili, termene și activități administrative ale clinicii."
            : "Pacienți care acceptă un interval disponibil mai devreme."
        }
        action={
          <Panel
            trigger={
              <Button>
                <T>{"Adaugă"}</T>
              </Button>
            }
            title={title}
            description="Datele sunt asociate acestei locații."
          >
            <WorkForm
              cid={cid}
              kind={kind}
              zone={clinic.timezone}
              staff={work.staff}
              options={options}
            />
          </Panel>
        }
      />
      <p>
        <Link
          className="text-link"
          href={`/clinics/${cid}/${path}${all ? "" : "?all=1"}`}
        >
          <T>{all ? "Arată activitățile active" : "Arată și istoricul"}</T>
        </Link>
      </p>
      <Table>
        <thead>
          <tr>
            {[
              "Activitate",
              "Pacient",
              "Responsabil",
              "Termen / preferință",
              "Stare",
              "Acțiuni",
            ].map((h) => (
              <th key={h}>
                <T>{h}</T>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {work.items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.title}</strong>
                {item.service_name && <p>{item.service_name}</p>}
                {item.notes && <small>{item.notes}</small>}
              </td>
              <td>
                {item.patient_id ? (
                  <Link href={`/clinics/${cid}/patients/${item.patient_id}`}>
                    {item.patient_name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td>{item.assigned_name ?? "—"}</td>
              <td>
                <LocaleDate
                  value={item.due_at ?? item.preferred_from}
                  options={{
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: clinic.timezone,
                  }}
                />
                {item.preferred_to && (
                  <>
                    {" "}
                    –{" "}
                    <LocaleDate
                      value={item.preferred_to}
                      options={{
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: clinic.timezone,
                      }}
                    />
                  </>
                )}
              </td>
              <td>
                <T>{workLabels[item.status]}</T>
                {item.offered_start && (
                  <p>
                    <LocaleDate
                      value={item.offered_start}
                      options={{
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: clinic.timezone,
                      }}
                    />
                  </p>
                )}
              </td>
              <td>
                <div className="form-stack">
                  {!["BOOKED", "CANCELLED"].includes(item.status) && (
                    <Panel
                      trigger={
                        <Button size="sm" variant="outline">
                          <T>{"Editează"}</T>
                        </Button>
                      }
                      title={item.title}
                      description="Modificările sunt înregistrate în audit."
                    >
                      <WorkForm
                        cid={cid}
                        kind={kind}
                        zone={clinic.timezone}
                        staff={work.staff}
                        options={options}
                        item={item}
                      />
                    </Panel>
                  )}
                  {kind === "WAITLIST" &&
                    ["OPEN", "OFFERED"].includes(item.status) && (
                      <Panel
                        trigger={
                          <Button size="sm" variant="outline">
                            <T>{"Propune interval"}</T>
                          </Button>
                        }
                        title="Interval disponibil"
                        description="Disponibilitatea se verifică din nou la confirmare."
                      >
                        <SlotOffer
                          cid={cid}
                          item={item}
                          zone={clinic.timezone}
                        />
                      </Panel>
                    )}
                  {item.status === "OFFERED" && (
                    <ActionForm
                      action={bookOffer.bind(
                        null,
                        cid,
                        item.id,
                        item.updated_at,
                      )}
                      submit="Creează programarea"
                    >
                      <label className="check-field">
                        <input type="checkbox" name="accepted" required />
                        <T>{"Pacientul a acceptat intervalul"}</T>
                      </label>
                    </ActionForm>
                  )}
                  {item.appointment_id && (
                    <Link
                      href={`/clinics/${cid}/calendar?appointment=${item.appointment_id}`}
                    >
                      <T>{"Vezi programarea"}</T>
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!work.items.length && (
            <tr>
              <td colSpan={6}>
                <T>{"Nu există activități în această listă."}</T>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <p className="muted">
        <T>
          {
            "Sunt afișate maximum 200 de înregistrări din filtrul ales, ordonate după termen."
          }
        </T>
      </p>
    </>
  );
}
