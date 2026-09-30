import { requireClinic, workspace } from "@/features/auth/access";
import { Shell } from "@/components/shell";
export default async function ClinicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const [context, data] = await Promise.all([
    requireClinic(clinicId),
    workspace(),
  ]);
  return (
    <Shell
      clinic={context.clinic}
      name={data.name}
      permissions={context.permissions}
      preferences={data.preferences}
    >
      {children}
    </Shell>
  );
}
