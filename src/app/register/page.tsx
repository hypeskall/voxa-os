import { T } from "@/components/locale-provider";
import { AccountPage } from "@/features/auth/account-page";
import { safeAuthDestination } from "@/features/auth/account-model";
import { db } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { SessionNotice } from "@/features/auth/session-notice";
export const metadata = { title: "Înregistrare" };
export const maxDuration = 60;
export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const search = await searchParams;
  if (hasSupabaseConfig()) {
    const client = await db();
    const { data: { user } } = await client.auth.getUser();
    if (user) return <main className="auth-page"><div className="auth-main"><div className="auth-box"><h1><T>{"Creează contul"}</T></h1><SessionNotice destination="/register" next={safeAuthDestination(search.next ?? "/")}/></div></div></main>;
  }
  return <AccountPage mode="register" next={safeAuthDestination(search.next ?? "/")}/>;
}
