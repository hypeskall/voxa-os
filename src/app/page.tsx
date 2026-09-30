import { redirect } from "next/navigation";
import { workspace } from "@/features/auth/access";
export default async function Home() {
  const { clinics, preferences } = await workspace();
  const clinic =
    clinics.find((c) => c.id === preferences?.default_clinic_id) ?? clinics[0];
  redirect(clinic ? `/clinics/${clinic.id}` : "/onboarding");
}
