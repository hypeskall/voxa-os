"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { localDate } from "@/lib/time";

export function LiveRefresh({ timeZone, selectedDate }: { timeZone?: string; selectedDate?: string }) {
  const router = useRouter();
  const previousDay = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (timeZone && previousDay.current === null) previousDay.current = localDate(timeZone);
    const refresh = () => {
      if (document.visibilityState === "visible" && !pending) {
        const day = timeZone ? localDate(timeZone) : null;
        if (day && day !== previousDay.current && selectedDate === previousDay.current) {
          const url = new URL(window.location.href);
          url.searchParams.set("date", day);
          url.searchParams.delete("appointment");
          previousDay.current = day;
          startTransition(() => router.replace(`${url.pathname}${url.search}`, { scroll: false }));
          return;
        }
        if (day) previousDay.current = day;
        startTransition(() => router.refresh());
      }
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, pending, timeZone, selectedDate]);
  return null;
}
