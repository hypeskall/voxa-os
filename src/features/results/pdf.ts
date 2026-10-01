import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ResultDetail } from "./model";

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line || " ");
  }
  return lines;
}
export async function resultPdf(result: ResultDetail, signature?: { bytes: ArrayBuffer; mime: string } | null, stamp?: { bytes: ArrayBuffer; mime: string } | null) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(join(process.cwd(), "node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff"));
  const font = await pdf.embedFont(fontBytes);
  let page: PDFPage = pdf.addPage([595.28, 841.89]); let y = 786;
  const color = rgb(.10,.22,.17); const gray = rgb(.35,.39,.37);
  const draw = (text: string, size = 10, x = 54, tone = color) => { page.drawText(text, { x, y, size, font, color: tone }); y -= size + 6; };
  page.drawRectangle({ x: 0, y: 814, width: 595.28, height: 28, color });
  draw(result.clinic_name.toUpperCase(), 16); draw(result.clinic_address, 9, 54, gray); if (result.clinic_phone) draw(result.clinic_phone, 9, 54, gray);
  y -= 18; draw("REZULTAT MEDICAL", 18); draw(result.title, 13); y -= 8;
  page.drawLine({ start: { x:54,y }, end: { x:541,y }, thickness: .7, color: rgb(.75,.78,.76) }); y -= 20;
  draw(`Pacient: ${result.patient_name}`, 10); draw(`Identificator pacient: ${result.patient_internal_id}`, 10); draw(`Serviciu: ${result.service_name}`, 10); draw(`Medic: ${result.doctor_name}${result.professional_code ? ` · parafă ${result.professional_code}` : ""}`, 10);
  draw(`Data rezultatului: ${new Intl.DateTimeFormat("ro-RO", { dateStyle:"long", timeZone: result.timezone }).format(new Date(result.validated_at ?? result.updated_at))}`, 10);
  y -= 18;
  for (const line of wrap(result.content, font, 10, 487)) {
    if (y < 110) { page = pdf.addPage([595.28,841.89]); y = 786; }
    draw(line, 10);
  }
  y = Math.max(90, y - 28);
  let x = 54;
  for (const image of [signature, stamp]) if (image) {
    try { const embedded = image.mime === "image/png" ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes); const scale = Math.min(120/embedded.width, 55/embedded.height, 1); page.drawImage(embedded, { x, y: y-embedded.height*scale, width: embedded.width*scale, height: embedded.height*scale }); x += 150; } catch { /* PDF remains valid when an unsupported scan cannot be embedded. */ }
  }
  page.drawText(`Document generat de Voxa · rezultat ${result.id} · versiunea ${result.version + 1}`, { x:54, y:32, size:7, font, color:gray });
  return pdf.save();
}
