import type { Clinic } from "@/features/auth/access";
import { Field, Input, Select } from "@/components/ui/form";
import { WhatsappTemplateField } from "@/features/settings/whatsapp-template-field";
export function ClinicFields({ clinic }: { clinic?: Clinic }) {
  return (
    <>
      <Field label="Denumire clinică">
        <Input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={clinic?.name}
        />
      </Field>
      <Field label="Adresă">
        <Input name="address" maxLength={250} defaultValue={clinic?.address} />
      </Field>
      <Field label="Telefon public">
        <Input name="phone" type="tel" maxLength={40} defaultValue={clinic?.phone} />
      </Field>
      <Field label="Telefon secundar">
        <Input name="phone_secondary" type="tel" maxLength={40} defaultValue={clinic?.phone_secondary} />
      </Field>
      <Field label="Email public">
        <Input name="email" type="email" maxLength={254} defaultValue={clinic?.email} />
      </Field>
      <Field label="Fus orar">
        <Select
          name="timezone"
          defaultValue={clinic?.timezone ?? "Europe/Bucharest"}
        >
          <option>Europe/Bucharest</option>
          <option>Europe/London</option>
          <option>Europe/Paris</option>
        </Select>
      </Field>
      <div className="form-grid scheduling-settings">
        <Field label="Increment programări" hint="Separat de durata serviciului.">
          <Select name="scheduling_increment_minutes" defaultValue={String(clinic?.scheduling_increment_minutes ?? 15)}>
            {[5, 10, 15, 20, 30, 60].map((value) => <option key={value} value={value}>{value} minute</option>)}
          </Select>
        </Field>
        <Field label="Calendar vizibil de la">
          <Input name="calendar_visible_start" type="time" defaultValue={(clinic?.calendar_visible_start ?? "08:00").slice(0, 5)} />
        </Field>
        <Field label="Calendar vizibil până la">
          <Input name="calendar_visible_end" type="time" defaultValue={(clinic?.calendar_visible_end ?? "20:00").slice(0, 5)} />
        </Field>
      </div>
      <Field label="Booking online">
        <Select
          name="public_booking_enabled"
          defaultValue={clinic?.public_booking_enabled ? "true" : "false"}
        >
          <option value="false">Dezactivat</option>
          <option value="true">Activ</option>
        </Select>
      </Field>
      <WhatsappTemplateField defaultValue={clinic?.whatsapp_reminder_template} />
      <Field
        label="Adresă publică"
        hint="Litere mici, cifre și cratimă. Exemplu: clinica-centru."
      >
        <Input
          name="booking_slug"
          maxLength={80}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          defaultValue={clinic?.booking_slug ?? ""}
          placeholder="clinica-centru"
        />
      </Field>
    </>
  );
}
