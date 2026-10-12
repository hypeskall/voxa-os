"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { T } from "@/components/locale-provider";
function protectedPath(path: string) {
  return /^\/(clinics|dashboard|account|onboarding|organizations|portal)(\/|$)/.test(path) && path !== "/portal/login";
}
export function SessionLock() {
  const path = usePathname();
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!protectedPath(path)) return;
    let deadline = 0, lastInteraction = 0, lastSent = 0, stopped = false, running = false;
    const lock = () => { window.location.replace("/auth/locked"); };
    async function check(activity = false) {
      if (running || stopped) return;
      running = true;
      try {
        const response = await fetch("/api/session/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activity }), cache: "no-store" });
        if (stopped) return;
        if (response.status === 401) {
          const state = await response.json();
          if (stopped) return;
          if (state.reason === "unauthenticated") window.location.replace("/login");
          else lock();
          return;
        }
        if (!response.ok) return;
        const status = await response.json();
        if (stopped) return;
        if (!status.allowed) { lock(); return; }
        deadline = Math.min(status.idleExpiresAt, status.absoluteExpiresAt);
        if (activity) lastSent = Date.now();
      } catch { /* The last verified deadline still applies while offline. */ }
      finally { running = false; }
    }
    function interaction(event: Event) {
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      if (deadline && Date.now() >= deadline) { lock(); return; }
      lastInteraction = Date.now();
      if (lastInteraction - lastSent >= 30000) void check(true);
    }
    function tick() {
      if (!deadline) return;
      const seconds = Math.ceil((deadline - Date.now()) / 1000);
      if (seconds <= 0) { lock(); return; }
      setRemaining(seconds <= 60 ? seconds : null);
      if (lastInteraction > lastSent && Date.now() - lastSent >= 30000 && document.visibilityState === "visible") void check(true);
    }
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach(name => window.addEventListener(name, interaction, { passive: true }));
    const timer = window.setInterval(tick, 1000);
    const poll = window.setInterval(() => void check(false), 30000);
    void check(false);
    return () => { stopped = true; events.forEach(name => window.removeEventListener(name, interaction)); window.clearInterval(timer); window.clearInterval(poll); };
  }, [path]);
  if (!protectedPath(path) || remaining === null) return null;
  return <div role="alert" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "var(--surface, white)", padding: 20, border: "1px solid currentColor", borderRadius: 12, boxShadow: "0 6px 30px #0003" }}>
    <p><T>{"Sesiunea se va bloca din cauza inactivității."}</T> {remaining}s</p>
    <button type="button"><T>{"Continuă sesiunea"}</T></button>
  </div>;
}
