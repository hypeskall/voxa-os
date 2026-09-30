import Link from "next/link";
import { DoorOpen, MonitorCog } from "lucide-react";
import { can } from "@/lib/permissions";
import { requireClinic } from "@/features/auth/access";
import { editorOptions, listCore } from "@/features/core-clinic/data";
import { modulePermission, moduleSpecs, type CoreModule } from "@/features/core-clinic/model";
import { Registry } from "@/features/core-clinic/registry";
import { CoreCreatePanel } from "@/features/core-clinic/create-panel";
import { PageHeading } from "@/components/ui/page";

export const metadata = { title: "Resurse" };

export default async function ResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { clinicId } = await params;
  const query = await searchParams;
  const resourceModule: CoreModule = query.tab === "equipment" ? "equipment" : "rooms";
  const { clinic, permissions } = await requireClinic(clinicId, modulePermission(resourceModule, "read"));
  const manage = can(permissions, modulePermission(resourceModule, "manage"));
  const [initial, options] = await Promise.all([
    listCore(clinicId, resourceModule),
    manage ? editorOptions(clinicId, resourceModule) : {},
  ]);
  const columns = ["id", "name", "active", "archived_at", "updated_at", ...moduleSpecs[resourceModule].columns.map(([key]) => key)];
  const safeInitial = {
    ...initial,
    items: initial.items.map((row) => Object.fromEntries(columns.map((key) => [key, row[key] ?? null])) as typeof row),
  };
  const label = resourceModule === "rooms" ? "Adaugă cabinet" : "Adaugă echipament";
  return (
    <>
      <PageHeading
        eyebrow={clinic.name}
        title="Resurse"
        description="Cabinetele și echipamentele folosite pentru alocarea programărilor."
        action={manage ? <CoreCreatePanel cid={clinicId} module={resourceModule} options={options} timeZone={clinic.timezone} label={label} /> : undefined}
      />
      <nav className="module-tabs" aria-label="Tip resursă">
        <Link href="?tab=rooms" className={resourceModule === "rooms" ? "selected" : ""}><DoorOpen size={16}/>Cabinete</Link>
        <Link href="?tab=equipment" className={resourceModule === "equipment" ? "selected" : ""}><MonitorCog size={16}/>Echipamente</Link>
      </nav>
      <div className="resource-context">
        <div><strong>{resourceModule === "rooms" ? "Spații de lucru" : "Aparatură medicală"}</strong><span>{resourceModule === "rooms" ? "Capacitate, tip și stare operațională." : "Amplasare, identificare și disponibilitate pentru mentenanță."}</span></div>
        {resourceModule === "equipment" && <Link className="text-link" href={`/clinics/${clinicId}/availability?tab=exceptions`}>Gestionează mentenanța</Link>}
      </div>
      <Registry
        key={resourceModule}
        cid={clinicId}
        module={resourceModule}
        initial={safeInitial}
        timeZone={clinic.timezone}
        emptyAction={manage ? <CoreCreatePanel cid={clinicId} module={resourceModule} options={options} timeZone={clinic.timezone} variant="outline" label={resourceModule === "rooms" ? "Adaugă primul cabinet" : "Adaugă primul echipament"} /> : undefined}
      />
    </>
  );
}
