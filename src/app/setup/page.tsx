import { T } from "@/components/locale-provider";
export default function Setup() {
  return (
    <main className="standalone">
      <p className="eyebrow"><T>{"VOXA · CONFIGURARE"}</T></p>
      <h1><T>{"Conectați spațiul de lucru"}</T></h1>
      <p className="muted"><T>{"Aplicația are nevoie de conexiunea la Supabase înainte de autentificare."}</T></p>
      <section className="surface">
        <h2><T>{"Configurare pentru administrator"}</T></h2>
        <ol className="list-decimal pl-5 space-y-3">
          <li><T>{"Porniți proiectul Supabase și aplicați migrations."}</T></li>
          <li><T>{"Completați URL-ul și cheia publică în .env.local, conform README."}</T></li>
          <li><T>{"Reporniți aplicația."}</T></li>
        </ol>
      </section>
      <p className="note"><T>{"Nu introduceți o cheie service role în configurația publică."}</T></p>
    </main>
  );
}
