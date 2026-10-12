import { T } from "@/components/locale-provider";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { RelationPicker } from "@/features/core-clinic/relation-picker";
import type { Option } from "@/features/core-clinic/model";
import { saveWork } from "./actions";
import type { WorkItem } from "./model";
function local(value: string | null | undefined, zone: string) {
  return value
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date(value))
        .replace(" ", "T")
    : "";
}
export function WorkForm({
  cid,
  kind,
  zone,
  staff,
  options,
  item,
}: {
  cid: string;
  kind: "TASK" | "WAITLIST";
  zone: string;
  staff: { id: string; name: string }[];
  options: { patients: Option[]; services: Option[]; doctors: Option[] };
  item?: WorkItem;
}) {
  return (
    <ActionForm
      action={saveWork.bind(null, cid, item?.id ?? null)}
      submit={item ? "Salvează modificările" : "Adaugă"}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="version" value={item?.updated_at ?? ""} />
      <Field label="Titlu">
        <Input
          name="title"
          required
          minLength={2}
          maxLength={160}
          defaultValue={
            item?.title ??
            (kind === "WAITLIST" ? "Solicitare interval disponibil" : "")
          }
        />
      </Field>
      <Field label="Responsabil">
        <Select name="assigned_to" defaultValue={item?.assigned_to ?? ""}>
          <option value="">
            <T>{"Nealocat"}</T>
          </option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      </Field>
      <RelationPicker
        cid={cid}
        module="patients"
        name="patient_id"
        label={kind === "WAITLIST" ? "Pacient" : "Pacient (opțional)"}
        initialOptions={options.patients}
        initialIds={item?.patient_id ? [item.patient_id] : []}
      />
      {kind === "WAITLIST" ? (
        <>
          <RelationPicker
            cid={cid}
            module="services"
            name="service_id"
            label="Serviciu"
            initialOptions={options.services}
            initialIds={item?.service_id ? [item.service_id] : []}
          />
          <RelationPicker
            cid={cid}
            module="doctors"
            name="doctor_id"
            label="Medic preferat (opțional)"
            initialOptions={options.doctors}
            initialIds={item?.doctor_id ? [item.doctor_id] : []}
          />
          <Field label="Disponibil de la">
            <Input
              name="preferred_from"
              type="datetime-local"
              required
              defaultValue={local(item?.preferred_from, zone)}
            />
          </Field>
          <Field label="Disponibil până la">
            <Input
              name="preferred_to"
              type="datetime-local"
              required
              defaultValue={local(item?.preferred_to, zone)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Termen (ora clinicii)">
            <Input
              name="due_at"
              type="datetime-local"
              defaultValue={local(item?.due_at, zone)}
            />
          </Field>
          <Field label="ID programare (opțional)">
            <Input
              name="appointment_id"
              defaultValue={item?.appointment_id ?? ""}
            />
          </Field>
        </>
      )}
      {item && (
        <Field label="Stare">
          <Select
            name="status"
            defaultValue={item.status === "OFFERED" ? "OPEN" : item.status}
          >
            <option value="OPEN">
              <T>{"De făcut"}</T>
            </option>
            {kind === "TASK" && (
              <>
                <option value="IN_PROGRESS">
                  <T>{"În lucru"}</T>
                </option>
                <option value="DONE">
                  <T>{"Finalizat"}</T>
                </option>
              </>
            )}
            <option value="CANCELLED">
              <T>{"Anulat"}</T>
            </option>
          </Select>
        </Field>
      )}
      <Field
        label="Detalii administrative"
        hint="Evitați datele medicale în aceste detalii."
      >
        <textarea
          className="input"
          name="notes"
          maxLength={2000}
          defaultValue={item?.notes ?? ""}
        />
      </Field>
    </ActionForm>
  );
}
