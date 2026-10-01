import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { LoginForm } from "@/features/auth/login-form";
export const metadata = { title: "Conectare" };
export default async function Login() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    redirect("/setup");
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) redirect("/");
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
            Acces securizat la spațiul operațional al Clinicii Maria.
          </p>
        </div>
        <footer>VOXA · Spațiu dedicat echipei clinicii</footer>
      </aside>
      <main className="auth-main">
        <div className="auth-box">
          <p className="eyebrow">BINE AȚI REVENIT</p>
          <h1>Conectare</h1>
          <p className="muted">Introduceți datele contului dumneavoastră.</p>
          <LoginForm />
          <p className="auth-note muted">
            Accesul este acordat de administratorul clinicii. Pentru ajutor cu
            datele contului, contactați administratorul.
          </p>
        </div>
      </main>
    </div>
  );
}
