import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { requireOrganization } from "@/features/organizations/access";
import { Button } from "@/components/ui/button";
import "../billing.css";
export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await requireOrganization(organizationId);
  return (
    <div className="billing-shell">
      <header className="billing-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">V</span>
          <span>
            VOXA<span className="marketing-os">-OS</span>
          </span>
        </Link>
        <form action={logout}>
          <Button variant="ghost">Deconectare</Button>
        </form>
      </header>
      <main className="billing-main">{children}</main>
    </div>
  );
}
