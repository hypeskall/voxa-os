"use client";
import { useState } from "react";
import { Input } from "@/components/ui/form";
import { isoToRomanian, romanianToIso } from "@/lib/locale/ro";

export function DateFieldRo({ value, onChange, ariaLabel = "Data" }: { value: string; onChange: (value: string) => void; ariaLabel?: string }) {
  const [display, setDisplay] = useState(isoToRomanian(value));
  function commit() {
    const parsed = romanianToIso(display);
    if (parsed) onChange(parsed);
    else setDisplay(isoToRomanian(value));
  }
  return <Input inputMode="numeric" aria-label={ariaLabel} placeholder="ZZ.LL.AAAA" value={display} onChange={(event) => setDisplay(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />;
}
