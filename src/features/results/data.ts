import "server-only";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { resultDetailSchema, resultListItemSchema, resultOptionSchema } from "./model";
export async function medicalResults(cid: string, pid?: string) {
  const { client } = await requireClinic(cid, "results.read");
  const { data, error } = await client.rpc("list_medical_results", { cid, pid: pid ?? null });
  if (error) throw error;
  return z.array(resultListItemSchema).parse(data);
}
export async function medicalResult(cid: string, id: string) {
  const { client } = await requireClinic(cid, "results.read");
  const { data, error } = await client.rpc("read_medical_result", { cid, result_id: id });
  if (error) throw error;
  return resultDetailSchema.parse(data);
}
export async function resultOptions(cid: string) {
  const { client } = await requireClinic(cid, "results.manage");
  const { data, error } = await client.rpc("result_appointment_options", { cid });
  if (error) throw error;
  return z.array(resultOptionSchema).parse(data);
}
