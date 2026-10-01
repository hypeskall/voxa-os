"use client";
import { useState } from "react";
import { Input } from "@/components/ui/form";
import { isoToRomanian, romanianToIso } from "@/lib/locale/ro";

export function DateFieldRo({ value, onChange, ariaLabel = "Data" }: { value: string; onChange: (value: string) => void; ariaLabel?: string }) {
  const [draft, setDraft] = useState({ source: value, text: isoToRomanian(value) });
  // Reset the draft when a slot click or calendar navigation changes the date.
  if (draft.source !== value) setDraft({ source: value, text: isoToRomanian(value) });
  const display = draft.source === value ? draft.text : isoToRomanian(value);
  function commit() {
    const parsed = romanianToIso(display);
    if (parsed) onChange(parsed);
    else setDraft({ source: value, text: isoToRomanian(value) });
  }
  return <Input inputMode="numeric" aria-label={ariaLabel} placeholder="ZZ.LL.AAAA" value={display} onChange={(event) => setDraft({ source: value, text: event.target.value })} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />;
}
