import { notFound } from "next/navigation";
import { moduleSchema } from "@/features/core-clinic/model";
import { CoreDetail } from "@/features/core-clinic/detail";
export default async function DetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string; module: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { clinicId, module: raw, id } = await params;
  const moduleKey = moduleSchema.safeParse(raw);
  if (!moduleKey.success) notFound();
  const { tab } = await searchParams;
  return <CoreDetail cid={clinicId} module={moduleKey.data} id={id} tab={tab} />;
}

