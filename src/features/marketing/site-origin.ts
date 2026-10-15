import "server-only";
import { appOrigin } from "@/lib/app-origin";

// Public search/sharing URLs are independent of Auth and billing return URLs.
export function marketingOrigin() {
  if (process.env.NODE_ENV !== "production") return appOrigin();
  const url = new URL(
    process.env.VOXA_PUBLIC_SITE_URL || "https://os.voxatech.ro",
  );
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(
      "Originea publică Voxa-OS trebuie să fie un URL HTTPS valid.",
    );
  }
  return url.origin;
}

export function indexableMarketing() {
  return (
    process.env.APP_ENVIRONMENT !== "staging" &&
    process.env.VERCEL_ENV !== "preview"
  );
}
