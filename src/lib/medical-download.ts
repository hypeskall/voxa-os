import "server-only";
import { decryptMedicalBytes } from "./medical-file-crypto";

export async function medicalDownloadResponse(file: Blob, path: string, fileName: string, mime = "application/pdf") {
 const bytes = decryptMedicalBytes(new Uint8Array(await file.arrayBuffer()), path);
 const safeName = fileName.replace(/[\r\n\x00-\x1f\x7f]/g, "").slice(0, 255) || "document";
 const encoded = encodeURIComponent(safeName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
 return new Response(Uint8Array.from(bytes).buffer, {
  headers: {
   "Content-Type": mime,
   "Content-Length": String(bytes.length),
   "Content-Disposition": `attachment; filename="document"; filename*=UTF-8''${encoded}`,
   "Cache-Control": "private, no-store, max-age=0",
   "X-Content-Type-Options": "nosniff",
   "Referrer-Policy": "no-referrer",
  },
 });
}
