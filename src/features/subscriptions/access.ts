import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/access";

export const organizationEntitled = cache(async (organizationId: string) => {
  const { client } = await requireUser();
  const { data, error } = await client.rpc("organization_access", {
    oid: organizationId,
  });
  if (error)
    throw new Error("Abonamentul nu a putut fi verificat. Reîncercați.");
  return data === true;
});
export async function requireSubscription(organizationId: string) {
  if (!(await organizationEntitled(organizationId)))
    redirect(`/organizations/${organizationId}/subscription-expired`);
}
