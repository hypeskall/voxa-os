"use client";
import { useState } from "react";
import { T, useLocale } from "@/components/locale-provider";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { calendarSlotsAction } from "@/features/calendar/actions";
import { localToInstant } from "@/features/core-clinic/validation";
import { offerSlot } from "./actions";
import type { WorkItem } from "./model";
export function SlotOffer({
  cid,
  item,
  zone,
}: {
  cid: string;
  item: WorkItem;
  zone: string;
}) {
  const { locale } = useLocale();
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: zone }).format(
      new Date(Math.max(Date.now(), new Date(item.preferred_from!).getTime())),
    ),
  );
  const [slots, setSlots] = useState<{ start_at: string; end_at: string }[]>(
    [],
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function load() {
    setPending(true);
    setSlots([]);
    setMessage("");
    try {
      const start = localToInstant(`${date}T00:00`, zone);
      const next = new Date(`${date}T12:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      const end = localToInstant(
        `${next.toISOString().slice(0, 10)}T00:00`,
        zone,
      );
      const result = await calendarSlotsAction(cid, {
        service_id: item.service_id,
        doctor_id: item.doctor_id,
        window_start: start,
        window_end: end,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const available = (
        result.data as { start_at: string; end_at: string }[]
      ).filter(
        (s) =>
          new Date(s.start_at).getTime() >=
            new Date(item.preferred_from!).getTime() &&
          new Date(s.end_at).getTime() <=
            new Date(item.preferred_to!).getTime(),
      );
      setSlots(available);
      if (!available.length)
        setMessage("Nu există intervale disponibile pentru această zi.");
    } catch {
      setMessage("Verificați data selectată.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="form-stack">
      <Field label="Data">
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSlots([]);
          }}
        />
      </Field>
      <Button type="button" variant="outline" disabled={pending} onClick={load}>
        <T>
          {pending
            ? "Se verifică disponibilitatea..."
            : "Caută intervale disponibile"}
        </T>
      </Button>
      {message && (
        <p role="status">
          <T>{message}</T>
        </p>
      )}
      {slots.length > 0 && (
        <ActionForm
          action={offerSlot.bind(null, cid, item.id, item.updated_at)}
          submit="Propune intervalul"
        >
          <Field label="Interval">
            <Select name="start_at">
              {slots.map((s) => (
                <option key={s.start_at} value={s.start_at}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: zone,
                  }).format(new Date(s.start_at))}
                </option>
              ))}
            </Select>
          </Field>
          <p className="muted">
            <T>
              {
                "Propunerea nu rezervă intervalul și nu trimite mesaje. Contactați pacientul și înregistrați acceptarea."
              }
            </T>
          </p>
        </ActionForm>
      )}
    </div>
  );
}
