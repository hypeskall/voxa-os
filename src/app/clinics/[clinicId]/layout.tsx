import { requireClinic, workspace } from "@/features/auth/access";
import { Shell } from "@/components/shell";
import { organizationsForUser } from "@/features/organizations/access";
export default async function ClinicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const [context, data, organizations] = await Promise.all([
    requireClinic(clinicId),
    workspace(),
    organizationsForUser(),
  ]);
  return (
    <Shell
      clinic={context.clinic}
      name={data.name}
      permissions={context.permissions}
      preferences={data.preferences}
      locations={data.clinics.map((c) => ({ id: c.id, name: c.name, organizationName: organizations.organizations.find((o) => o.id === c.organization_id)?.name ?? "Organizație" }))}
    >
      {children}
    </Shell>
  );
}
