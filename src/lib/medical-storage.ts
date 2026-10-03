export const MEDICAL_BUCKET = "voxa-medical";
export const SIGNED_DOWNLOAD_TTL_SECONDS = 60;
// Leave multipart headroom under Vercel's request limit. Applies to the
// aggregate file payload of one action, including signature + stamp together.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
