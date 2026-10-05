export default function ClinicLoading() {
  return <section className="workspace-loading" role="status" aria-label="Se încarcă pagina" aria-busy="true">
    <span className="muted">Se încarcă…</span>
    <div className="skeleton w-1/3" />
    <div className="skeleton" />
    <div className="skeleton w-2/3" />
  </section>;
}
