export default function Setup() {
  return (
    <main className="standalone">
      <p className="eyebrow">VOXA OS · CONFIGURARE</p>
      <h1>Conectați spațiul de lucru</h1>
      <p className="muted">
        Aplicația are nevoie de conexiunea la Supabase înainte de autentificare.
      </p>
      <section className="surface">
        <h2>Configurare pentru administrator</h2>
        <ol className="list-decimal pl-5 space-y-3">
          <li>Porniți proiectul Supabase și aplicați migrations.</li>
          <li>
            Completați URL-ul și cheia publică în .env.local, conform README.
          </li>
          <li>Reporniți aplicația.</li>
        </ol>
      </section>
      <p className="note">
        Nu introduceți o cheie service role în configurația publică.
      </p>
    </main>
  );
}
