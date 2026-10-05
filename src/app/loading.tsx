import { LocalizedElement } from "@/components/locale-provider";
export default function Loading() {
  return (
    <LocalizedElement as="main" className="standalone" aria-label="Se încarcă" aria-busy="true">
      <div className="skeleton w-1/3" />
      <div className="skeleton" />
      <div className="skeleton w-2/3" />
    </LocalizedElement>
  );
}
