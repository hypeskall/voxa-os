import { BillingPage } from "@/features/subscriptions/billing-page";
export const metadata = { title: "Abonament și licență" };
export default async function Billing({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <BillingPage organizationId={organizationId} />;
}
