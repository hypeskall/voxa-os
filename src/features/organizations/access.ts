import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/access";
import { requireSubscription } from "@/features/subscriptions/access";

export const organizationsForUser = cache(async () => {
  const { client, user } = await requireUser();
  const [members, organizations] = await Promise.all([
    client.from("organization_members").select("organization_id,role,status").eq("user_id", user.id),
    client.from("organizations").select("id,name,onboarding_completed,trial_ends_at,logo_path").order("created_at"),
  ]);
  if (members.error || organizations.error) throw new Error("Organizațiile nu au putut fi încărcate.");
  return { organizations: organizations.data, memberships: members.data };
});
export const requireOrganization = cache(async (id: string, owner = false, operational = false) => {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user } = await requireUser();
  const { organizations, memberships } = await organizationsForUser();
  const organization = organizations.find((item) => item.id === id);
  const membership = memberships.find((item) => item.organization_id === id && item.status === "active");
  if (!organization || !membership || (owner && membership.role !== "OWNER")) notFound();
  if (operational) await requireSubscription(id);
  return { client, user, organization, membership };
});
