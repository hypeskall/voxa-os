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
          <span className="brand-mark">V</span>
          <span className="brand-label">
            VOXA
          </span>
        </div>
        <div className="auth-statement">
          <p className="eyebrow">ADMINISTRARE MEDICALĂ</p>
          <h2>
            Un spațiu de lucru.
            <br />O echipă conectată.
          </h2>
          <p>
            Acces securizat la spațiul operațional al clinicii dumneavoastră.
          </p>
        </div>
        <footer>VOXA · Spațiu dedicat echipei clinicii</footer>
      </aside>
      <main className="auth-main">
        <div className="auth-box">
          <p className="eyebrow">BINE AȚI REVENIT</p>
          <h1>Conectare</h1>
          <p className="muted">Introduceți datele contului dumneavoastră.</p>
          {search.error === "link" && <p className="message error" role="alert">Linkul nu mai este valid. Solicitați un link nou în același browser.</p>}
          {search.password === "updated" && <p className="message success" role="status">Parola a fost actualizată. Conectați-vă din nou.</p>}
          {user ? <SessionNotice next={next}/> : <LoginForm next={next}/>}
          <p className="auth-note"><Link className="text-link" href="/forgot-password">Ai uitat parola?</Link></p>
          <p className="auth-note">O clinică nouă? <Link className="text-link" href={`/register?next=${encodeURIComponent(next)}`}>Creează un cont</Link></p>
        </div>
      </main>
    </div>
  );
}
