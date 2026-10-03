// Public project identifiers are a safety boundary, never credentials.
export function assertDeploymentTarget(environment: string | undefined, ref: string | undefined, url: string | undefined, origin: string | undefined) {
  if (environment !== "staging") return;
  if (!ref || !/^[a-z]{20}$/.test(ref) || ref === "fibcbsdattoqiyizzeda" || url !== `https://${ref}.supabase.co`)
    throw new Error("Configurația staging trebuie să folosească proiectul Supabase separat.");
  let parsed: URL;
  try { parsed = new URL(origin ?? ""); } catch { throw new Error("Originea staging lipsește."); }
  if (parsed.protocol !== "https:" || parsed.origin !== origin || parsed.username || parsed.password || parsed.hostname === "voxa-os.vercel.app")
    throw new Error("Originea staging trebuie să fie un domeniu HTTPS separat.");
}
