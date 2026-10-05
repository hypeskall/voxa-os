import { T } from "@/components/locale-provider";
import { requireClinic, workspace } from "@/features/auth/access";
import {
  saveClinic,
  savePreferences,
} from "@/features/settings/actions";
import { ClinicFields } from "@/features/settings/clinic-fields";
import { PageHeading, Section } from "@/components/ui/page";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { can } from "@/lib/permissions";
export const metadata = { title: "Setări" };
export default async function Settings({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const { clinic, permissions } = await requireClinic(clinicId);
  const { preferences } = await workspace();
  const visible = preferences?.visible_columns && typeof preferences.visible_columns === "object" && !Array.isArray(preferences.visible_columns) ? preferences.visible_columns : {};
  const patientColumns = Array.isArray(visible.patients) ? visible.patients.filter((v):v is string=>typeof v==="string") : ["internal_id","phone","email"];
  const dashboardModules=preferences?.dashboard_modules??["metrics","upcoming","alerts","activity"];
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRARE"
        title="Setări"
        description="Datele clinicii și preferințele spațiului de lucru."
      />
      <div className="split-layout">
        <Section
          title="Datele clinicii"
          description="Informațiile publice și operaționale ale clinicii."
        >
          {can(permissions, "clinic.manage") ? (
            <>
              <ActionForm action={saveClinic.bind(null, clinicId)}>
                <ClinicFields clinic={clinic} />
              </ActionForm>
              {clinic.public_booking_enabled && clinic.booking_slug && (
                <Button asChild variant="outline">
                  <Link href={`/book/${clinic.booking_slug}`} target="_blank"><T>{"Deschide booking-ul public"}</T></Link>
                </Button>
              )}
            </>
          ) : (
            <dl className="detail-grid">
              <div>
                <dt><T>{"Denumire"}</T></dt>
                <dd>{clinic.name}</dd>
              </div>
              <div>
                <dt><T>{"Adresă"}</T></dt>
                <dd>{clinic.address || "Necompletată"}</dd>
              </div>
              <div>
                <dt><T>{"Fus orar"}</T></dt>
                <dd>{clinic.timezone}</dd>
              </div>
              <div><dt><T>{"Telefon"}</T></dt><dd>{clinic.phone || "Necompletat"}</dd></div>
              <div><dt><T>{"Telefon secundar"}</T></dt><dd>{clinic.phone_secondary || "Necompletat"}</dd></div>
              <div><dt><T>{"Email"}</T></dt><dd>{clinic.email || "Necompletat"}</dd></div>
            </dl>
          )}
        </Section>
        <Section
          title="Preferințe personale"
          description="Se aplică doar contului dumneavoastră."
        >
          <ActionForm action={savePreferences}>
            <input type="hidden" name="default_clinic_id" value={clinicId} />
            <Field label="Densitatea tabelelor">
              <Select
                name="density"
                defaultValue={preferences?.density ?? "compact"}
              >
                <option value="compact"><T>{"Compactă"}</T></option>
                <option value="comfortable"><T>{"Confortabilă"}</T></option>
              </Select>
            </Field>
            <Field label="Vizualizare calendar implicită">
              <Select name="calendar_view" defaultValue={preferences?.calendar_view??"week"}><option value="day"><T>{"Zi"}</T></option><option value="week"><T>{"Săptămână"}</T></option><option value="month"><T>{"Lună"}</T></option><option value="agenda"><T>{"Agendă"}</T></option></Select>
            </Field>
            <fieldset className="preference-checks"><legend><T>{"Coloane vizibile în registrul pacienților"}</T></legend>{[["internal_id","Identificator"],["phone","Telefon"],["email","Email"]].map(([value,label])=><label key={value}><input type="checkbox" name="patient_columns" value={value} defaultChecked={patientColumns.includes(value)}/><T>{label}</T></label>)}</fieldset>
            <fieldset className="preference-checks"><legend><T>{"Secțiuni dashboard"}</T></legend>{[["metrics","Indicatori"],["upcoming","Programări următoare"],["alerts","Atenție necesară"],["activity","Activitate recentă"]].map(([value,label])=><label key={value}><input type="checkbox" name="dashboard_modules" value={value} defaultChecked={dashboardModules.includes(value)}/><T>{label}</T></label>)}</fieldset>
          </ActionForm>
        </Section>
      </div>
      <Section title="Configurare pe module" description="Setările operaționale sunt păstrate lângă datele pe care le controlează."><div className="settings-link-grid">
        <Link href={`/clinics/${clinicId}/team`}><T>{"Utilizatori și roluri"}</T><small><T>{"Acces în clinică și permisiuni"}</T></small></Link>
        <Link href={`/clinics/${clinicId}/specialities`}><T>{"Specialități"}</T><small><T>{"Nomenclator folosit în profilurile medicilor"}</T></small></Link>
        <Link href={`/clinics/${clinicId}/notifications`}><T>{"Notificări"}</T><small><T>{"Canale, șabloane și livrare"}</T></small></Link>
        <Link href={`/clinics/${clinicId}/services`}><T>{"Servicii"}</T><small><T>{"Durate, resurse și eligibilitate"}</T></small></Link>
        <Link href={`/clinics/${clinicId}/resources`}><T>{"Resurse"}</T><small><T>{"Cabinete și echipamente"}</T></small></Link>
        <Link href={`/clinics/${clinicId}/availability`}><T>{"Disponibilitate"}</T><small><T>{"Program de lucru și indisponibilități"}</T></small></Link>
        <Link href={`/clinics/${clinicId}/settings/portal`}><T>{"Portal pacient"}</T><small><T>{"Booking și acces pacient"}</T></small></Link>
      </div></Section>
    </>
  );
}
