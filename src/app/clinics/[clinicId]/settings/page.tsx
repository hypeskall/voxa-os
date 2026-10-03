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
                  <Link href={`/book/${clinic.booking_slug}`} target="_blank">
                    Deschide booking-ul public
                  </Link>
                </Button>
              )}
            </>
          ) : (
            <dl className="detail-grid">
              <div>
                <dt>Denumire</dt>
                <dd>{clinic.name}</dd>
              </div>
              <div>
                <dt>Adresă</dt>
                <dd>{clinic.address || "Necompletată"}</dd>
              </div>
              <div>
                <dt>Fus orar</dt>
                <dd>{clinic.timezone}</dd>
              </div>
              <div><dt>Telefon</dt><dd>{clinic.phone || "Necompletat"}</dd></div>
              <div><dt>Telefon secundar</dt><dd>{clinic.phone_secondary || "Necompletat"}</dd></div>
              <div><dt>Email</dt><dd>{clinic.email || "Necompletat"}</dd></div>
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
                <option value="compact">Compactă</option>
                <option value="comfortable">Confortabilă</option>
              </Select>
            </Field>
            <Field label="Vizualizare calendar implicită">
              <Select name="calendar_view" defaultValue={preferences?.calendar_view??"week"}><option value="day">Zi</option><option value="week">Săptămână</option><option value="month">Lună</option><option value="agenda">Agendă</option></Select>
            </Field>
            <fieldset className="preference-checks"><legend>Coloane vizibile în registrul pacienților</legend>{[["internal_id","Identificator"],["phone","Telefon"],["email","Email"]].map(([value,label])=><label key={value}><input type="checkbox" name="patient_columns" value={value} defaultChecked={patientColumns.includes(value)}/>{label}</label>)}</fieldset>
            <fieldset className="preference-checks"><legend>Secțiuni dashboard</legend>{[["metrics","Indicatori"],["upcoming","Programări următoare"],["alerts","Atenție necesară"],["activity","Activitate recentă"]].map(([value,label])=><label key={value}><input type="checkbox" name="dashboard_modules" value={value} defaultChecked={dashboardModules.includes(value)}/>{label}</label>)}</fieldset>
          </ActionForm>
        </Section>
      </div>
      <Section title="Configurare pe module" description="Setările operaționale sunt păstrate lângă datele pe care le controlează."><div className="settings-link-grid">
        <Link href={`/clinics/${clinicId}/team`}>Utilizatori și roluri<small>Acces în clinică și permisiuni</small></Link>
        <Link href={`/clinics/${clinicId}/specialities`}>Specialități<small>Nomenclator folosit în profilurile medicilor</small></Link>
        <Link href={`/clinics/${clinicId}/notifications`}>Notificări<small>Canale, șabloane și livrare</small></Link>
        <Link href={`/clinics/${clinicId}/services`}>Servicii<small>Durate, resurse și eligibilitate</small></Link>
        <Link href={`/clinics/${clinicId}/resources`}>Resurse<small>Cabinete și echipamente</small></Link>
        <Link href={`/clinics/${clinicId}/availability`}>Disponibilitate<small>Program de lucru și indisponibilități</small></Link>
        <Link href={`/clinics/${clinicId}/settings/portal`}>Portal pacient<small>Booking și acces pacient</small></Link>
      </div></Section>
    </>
  );
}
