import "server-only";

export type MedicalMime = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

function detectedMime(bytes: Uint8Array): MedicalMime | null {
  if (bytes.length>=5 && String.fromCharCode(...bytes.slice(0,5))==="%PDF-") return "application/pdf";
  if (bytes.length>=8 && [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)) return "image/png";
  if (bytes.length>=3 && bytes[0]===255&&bytes[1]===216&&bytes[2]===255) return "image/jpeg";
  if (bytes.length>=12 && String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP") return "image/webp";
  return null;
}

export async function validateMedicalFile(file: File, allowed: readonly MedicalMime[], maxBytes: number) {
  if (file.size<1||file.size>maxBytes||!allowed.includes(file.type as MedicalMime)) return null;
  const header=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const detected=detectedMime(header);
  return detected===file.type&&allowed.includes(detected)?detected:null;
}
