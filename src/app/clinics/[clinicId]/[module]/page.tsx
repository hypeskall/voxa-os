import { T } from "@/components/locale-provider";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireClinic, workspace } from "@/features/auth/access";
import { can } from "@/lib/permissions";
import {
  moduleSchema,
  moduleSpecs,
  modulePermission,
} from "@/features/core-clinic/model";
import {
  listCore,
  editorOptions,
  optionsFor,
} from "@/features/core-clinic/data";
import { Registry } from "@/features/core-clinic/registry";
import { CoreCreatePanel } from "@/features/core-clinic/create-panel";
import { CatalogRegistry } from "@/features/core-clinic/catalog-registry";
import { PageHeading } from "@/components/ui/page";
export default async function CoreRegistry({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string; module: string }>;
  searchParams: Promise<{ resource?: string; kind?: string }>;
}) {
  const { clinicId, module: raw } = await params;
  const parsed = moduleSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const moduleKey = parsed.data;
  if (moduleKey === "rooms" || moduleKey === "equipment") redirect(`/clinics/${clinicId}/resources?tab=${moduleKey}`);
  if (moduleKey === "exceptions") redirect(`/clinics/${clinicId}/availability?tab=exceptions`);
  const [{ clinic, permissions }, workspaceData] = await Promise.all([
    requireClinic(clinicId, modulePermission(moduleKey, "read")),
    workspace(),
  ]);
  const manage = can(permissions, modulePermission(moduleKey, "manage"));
  const search = await searchParams;
  const resource = z.uuid().safeParse(search.resource);
  const initialFilter =
    resource.success && ["availability", "exceptions"].includes(moduleKey)
      ? resource.data
      : null;
  const [initial, options, filters] = await Promise.all([
    listCore(clinicId, moduleKey, { filter_id: initialFilter }),
    manage ? editorOptions(clinicId, moduleKey) : {},
    moduleKey === "services"
      ? optionsFor(clinicId, "categories")
      : moduleKey === "doctors"
        ? optionsFor(clinicId, "specialities")
        : [],
  ]);
  const columns = [
    "id",
    "name",
    "active",
    "archived_at",
    "updated_at",
    ...moduleSpecs[moduleKey].columns.map(([key]) => key),
    ...(moduleKey === "doctors"
      ? ["speciality_names", "service_names", "availability_count"]
      : moduleKey === "services"
        ? [
            "category_name",
            "doctor_names",
            "room_names",
            "equipment_names",
            "duration_is_demo_default",
          ]
        : []),
  ];
  const safeInitial = {
    ...initial,
    items: initial.items.map(
      (row) =>
        Object.fromEntries(
          columns.map((k) => [k, row[k] ?? null]),
        ) as typeof row,
    ),
  };
  const preset =
    resource.success &&
    ["doctor", "room", "equipment"].includes(search.kind ?? "")
      ? { kind: search.kind!, id: resource.data }
      : undefined;
  const visible = workspaceData.preferences?.visible_columns;
  const patientColumns = moduleKey === "patients" && visible && typeof visible === "object" && !Array.isArray(visible) && Array.isArray(visible.patients)
    ? visible.patients.filter((value): value is string => typeof value === "string")
    : undefined;
  return (
    <>
      <PageHeading
        eyebrow={clinic.name}
        title={moduleSpecs[moduleKey].title}
        description={moduleSpecs[moduleKey].description}
        action={
          manage ? (
            <CoreCreatePanel
              cid={clinicId}
              module={moduleKey}
              options={options}
              timeZone={clinic.timezone}
              preset={preset}
            />
          ) : undefined
        }
      />
      {moduleKey === "services" && (
        <div className="mb-5">
          <Link className="text-link" href={`/clinics/${clinicId}/categories`}><T>{"Gestionează categoriile de servicii"}</T></Link>
        </div>
      )}
      {moduleKey === "doctors" || moduleKey === "services" ? (
        <CatalogRegistry
          cid={clinicId}
          module={moduleKey}
          initial={safeInitial}
          filterOptions={filters}
          emptyAction={manage ? <CoreCreatePanel cid={clinicId} module={moduleKey} options={options} timeZone={clinic.timezone} variant="outline" label={moduleKey === "doctors" ? "Adaugă primul medic" : "Adaugă primul serviciu"} /> : undefined}
        />
      ) : (
        <Registry
          key={`${clinicId}/${moduleKey}/${initialFilter ?? "all"}`}
          cid={clinicId}
          module={moduleKey}
          initial={safeInitial}
          timeZone={clinic.timezone}
          filterOptions={filters}
          initialFilter={initialFilter}
          visibleColumnKeys={patientColumns}
          emptyAction={manage ? <CoreCreatePanel cid={clinicId} module={moduleKey} options={options} timeZone={clinic.timezone} variant="outline" /> : undefined}
        />
      )}
    </>
  );
}

