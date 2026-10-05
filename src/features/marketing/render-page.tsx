import { db } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { LandingPage } from "./landing-page";
import type { MarketingPage } from "./navigation";
import "@/app/marketing.css";

export async function renderMarketingPage(page: MarketingPage = "home") {
  let authenticated = false;
  if (hasSupabaseConfig()) {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    authenticated = Boolean(user);
  }
  const media = process.env.VOXA_DEMO_VIDEO_URL;
  const videoSrc =
    media &&
    (/^\/(?!\/)[\w/.-]+\.(mp4|webm)$/.test(media) ||
      /^https:\/\/[^\s]+\.(mp4|webm)(\?[^\s]*)?$/.test(media))
      ? media
      : undefined;
  const contact = process.env.VOXA_SUPPORT_EMAIL?.trim();
  const supportEmail =
    contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined;
  return (
    <LandingPage
      page={page}
      authenticated={authenticated}
      videoSrc={videoSrc}
      supportEmail={supportEmail}
    />
  );
}
