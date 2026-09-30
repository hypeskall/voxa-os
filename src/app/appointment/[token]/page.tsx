import { notFound } from "next/navigation";
import { publicServerDb } from "@/lib/supabase/public-server";
import { tokenDigest, validTokenShape } from "@/features/confirmations/token";
import { confirmationDetailsSchema } from "@/features/confirmations/model";
import { ConfirmationView } from "@/features/confirmations/confirmation-view";

export const dynamic = "force-dynamic";
export default async function ConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!validTokenShape(token)) notFound();
  const digest = tokenDigest(token);
  const { data, error } = await publicServerDb().rpc("public_confirmation_details", { token_digest: digest, request_key: digest });
  const parsed = confirmationDetailsSchema.safeParse(data);
  if (error || !parsed.success) notFound();
  return <ConfirmationView token={token} details={parsed.data}/>;
}
