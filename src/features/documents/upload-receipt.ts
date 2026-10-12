import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const uploadMetadata = z.object({
  title: z.string().trim().min(2).max(200),
  document_type_id: z.uuid(),
  appointment_id: z.uuid().nullable().default(null),
  visible_to_patient: z.boolean().default(false),
  file_name: z.string().min(1).max(255),
  mime: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(20 * 1024 * 1024),
  result: z.boolean().default(false),
});
const receiptSchema = uploadMetadata.extend({
  cid: z.uuid(),
  pid: z.uuid(),
  uid: z.uuid(),
  path: z.string().max(500),
  expires: z.number().int(),
});
function mac(value: string) {
  const secret =
    process.env.DOCUMENT_UPLOAD_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Încărcarea directă nu este configurată.");
  return createHmac("sha256", secret)
    .update(`voxa:document-upload:v1:${value}`)
    .digest();
}
export function signUploadReceipt(value: z.infer<typeof receiptSchema>) {
  const payload = Buffer.from(
    JSON.stringify(receiptSchema.parse(value)),
  ).toString("base64url");
  return `${payload}.${mac(payload).toString("base64url")}`;
}
export function readUploadReceipt(
  token: string,
  cid: string,
  pid: string,
  uid: string,
) {
  if (token.length > 6000) throw new Error("Receipt invalid");
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Receipt invalid");
  const supplied = Buffer.from(parts[1], "base64url");
  const expected = mac(parts[0]);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new Error("Receipt invalid");
  const receipt = receiptSchema.parse(
    JSON.parse(Buffer.from(parts[0], "base64url").toString()),
  );
  if (
    receipt.cid !== cid ||
    receipt.pid !== pid ||
    receipt.uid !== uid ||
    receipt.expires <= Date.now() ||
    !receipt.path.startsWith(`${cid}/${pid}/documents/`)
  )
    throw new Error("Receipt expired or invalid");
  return receipt;
}
