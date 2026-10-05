import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { can, type Permission } from "@/lib/permissions";
import { z } from "zod";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { requireSubscription } from "@/features/subscriptions/access";
import { mfaRequired } from "./mfa";
import { safeMfaDestination } from "./mfa-model";
export const authenticatedUser = cache(async () => {
  if (!hasSupabaseConfig())
    redirect("/setup");
  const client = await db();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  return { client, user };
});
export const requireUser = cache(async (next = "/dashboard") => {
  const session = await authenticatedUser();
  if (await mfaRequired(session.client, session.user))
    redirect(`/auth/mfa?next=${encodeURIComponent(safeMfaDestination(next))}`);
  return session;
});
export const workspace = cache(async () => {
  const { client, user } = await requireUser();
  const [clinics, profile, preferences] = await Promise.all([
    client
      .from("clinics")
      .select("id,organization_id,name,address,city,county,postal_code,phone,phone_secondary,email,timezone,public_booking_enabled,booking_slug,scheduling_increment_minutes,calendar_visible_start,calendar_visible_end,whatsapp_reminder_template")
      .order("name"),
    client.from("profiles").select("full_name").eq("id", user.id).single(),
    client
      .from("user_preferences")
      .select("density,default_clinic_id,calendar_view,calendar_filters,visible_columns,dashboard_modules")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (clinics.error || profile.error || preferences.error)
    throw new Error("Datele spațiului de lucru nu au putut fi încărcate.");
  return {
    user,
    clinics: clinics.data,
    name: profile.data.full_name,
    preferences: preferences.data,
  };
});
export type Clinic = {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  city: string;
  county: string;
  postal_code: string;
  phone: string;
  phone_secondary: string;
  email: string;
  timezone: string;
  public_booking_enabled: boolean;
  booking_slug: string | null;
  scheduling_increment_minutes: number;
  calendar_visible_start: string;
  calendar_visible_end: string;
  whatsapp_reminder_template: string;
};
export type Preferences = {
  density: "compact" | "comfortable";
  default_clinic_id: string | null;
  calendar_view: "day" | "week" | "month" | "agenda";
  calendar_filters: import("@/types/database").Json;
  visible_columns: import("@/types/database").Json;
  dashboard_modules: string[];
};
// This cache lives only for the current React server request. Layouts, pages
// and option loaders share the clinic lookup while checking each permission.
const clinicContext = cache(
  async (id: string) => {
    if (!z.uuid().safeParse(id).success) notFound();
    const { client, user } = await requireUser();
    const [clinic, grants, membership] = await Promise.all([
      client
        .from("clinics")
        .select("id,organization_id,name,address,city,county,postal_code,phone,phone_secondary,email,timezone,public_booking_enabled,booking_slug,scheduling_increment_minutes,calendar_visible_start,calendar_visible_end,whatsapp_reminder_template")
        .eq("id", id)
        .single(),
      client.rpc("my_permissions", { cid: id }),
      client
        .from("clinic_memberships")
        .select("role")
        .eq("clinic_id", id)
        .eq("user_id", user.id)
        .eq("active", true)
        .single(),
    ]);
    if (
      clinic.error ||
      membership.error ||
      grants.error
    )
      notFound();
    const [, organization] = await Promise.all([
      requireSubscription(clinic.data.organization_id),
      client.from("organizations").select("onboarding_completed").eq("id", clinic.data.organization_id).single(),
    ]);
    if (organization.error) throw new Error("Starea organizației nu a putut fi verificată.");
    return {
      client,
      user,
      clinic: clinic.data,
      permissions: grants.data,
      role: membership.data.role,
      onboardingCompleted: organization.data.onboarding_completed,
    };
  },
);
export const requireClinic = cache(async (id: string, permission: Permission = "clinic.read") => {
  const { onboardingCompleted, ...context } = await clinicContext(id);
  if (!can(context.permissions ?? [], permission)) notFound();
  if (!onboardingCompleted) redirect(`/onboarding?organization=${context.clinic.organization_id}`);
  return context;
});
