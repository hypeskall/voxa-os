import { T, LocalizedElement } from "@/components/locale-provider";
export default function ClinicLoading() {
  return <LocalizedElement as="section" className="workspace-loading" role="status" aria-label="Se încarcă pagina" aria-busy="true">
    <span className="muted"><T>{"Se încarcă…"}</T></span>
    <div className="skeleton w-1/3" />
    <div className="skeleton" />
    <div className="skeleton w-2/3" />
  </LocalizedElement>;
}
