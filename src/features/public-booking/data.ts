import "server-only";
import { z } from "zod";
import { publicServerDb } from "@/lib/supabase/public-server";
import { bookingClinicSchema, publicCatalogSchema } from "./model";

export async function publicClinics() {
  const { data, error } = await publicServerDb().rpc("list_public_booking_clinics");
  if (error) throw new Error("Locațiile nu sunt disponibile momentan.");
  return z.array(bookingClinicSchema).parse(data);
}
export async function publicCatalog(slug: string) {
  const { data, error } = await publicServerDb().rpc("public_booking_catalog", { slug });
  if (error || !data) return null;
  return publicCatalogSchema.parse(data);
}

