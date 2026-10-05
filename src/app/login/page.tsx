import { T } from "@/components/locale-provider";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { LoginForm } from "@/features/auth/login-form";
import Link from "next/link";
import { safeAuthDestination } from "@/features/auth/account-model";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { SessionNotice } from "@/features/auth/session-notice";
export const metadata = { title: "Conectare" };
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; password?: string; switch?: string }> }) {
  const search = await searchParams;
  const next = safeAuthDestination(search.next ?? "/");
  if (!hasSupabaseConfig())
    redirect("/setup");
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user && search.switch !== "1") redirect(next === "/" ? "/dashboard" : next);
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="brand">
          <span className="brand-mark"><T>{"V"}</T></span>
          <span className="brand-label"><T>{"VOXA"}</T></span>
        </div>
        <div className="auth-statement">
          <p className="eyebrow"><T>{"ADMINISTRARE MEDICALĂ"}</T></p>
          <h2><T>{"Un spațiu de lucru."}</T><br /><T>{"O echipă conectată."}</T></h2>
          <p><T>{"Acces securizat la spațiul operațional al clinicii dumneavoastră."}</T></p>
        </div>
        <footer><T>{"VOXA · Spațiu dedicat echipei clinicii"}</T></footer>
      </aside>
      <main className="auth-main">
        <div className="auth-box">
          <p className="eyebrow"><T>{"BINE AȚI REVENIT"}</T></p>
          <h1><T>{"Conectare"}</T></h1>
          <p className="muted"><T>{"Introduceți datele contului dumneavoastră."}</T></p>
          {search.error === "link" && <p className="message error" role="alert"><T>{"Linkul nu mai este valid. Solicitați un link nou în același browser."}</T></p>}
          {search.password === "updated" && <p className="message success" role="status"><T>{"Parola a fost actualizată. Conectați-vă din nou."}</T></p>}
          {user ? <SessionNotice next={next}/> : <LoginForm next={next}/>}
          <p className="auth-note"><Link className="text-link" href="/forgot-password"><T>{"Ai uitat parola?"}</T></Link></p>
          <p className="auth-note"><T>{"O clinică nouă? "}</T><Link className="text-link" href={`/register?next=${encodeURIComponent(next)}`}><T>{"Creează un cont"}</T></Link></p>
        </div>
      </main>
    </div>
  );
}
