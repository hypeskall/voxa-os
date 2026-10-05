"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { T } from "@/components/locale-provider";

export function MarketingROI() {
  const [appointments, setAppointments] = useState(20);
  const [minutes, setMinutes] = useState(5);
  const hours = Math.round((appointments * minutes * 22) / 60);
  const counter = useRef<HTMLSpanElement>(null);
  const previous = useRef(hours);
  useEffect(() => {
    const element = counter.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = String(hours);
      previous.current = hours;
      return;
    }
    const from = previous.current;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - started) / 500, 1);
      const current = Math.round(
        from + (hours - from) * (1 - Math.pow(1 - progress, 3)),
      );
      element.textContent = String(current);
      previous.current = current;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hours]);
  return (
    <section
      className="marketing-container marketing-section premium-roi"
      aria-labelledby="roi-title"
    >
      <div className="roi-copy" data-reveal>
        <span className="marketing-eyebrow">
          <Clock3 size={14} />
          <T>{"TIMPUL ECHIPEI CONTEAZĂ"}</T>
        </span>
        <h2 id="roi-title">
          <T>{"Câteva minute aici."}</T>
          <br />
          <T>{"Ore întregi, înapoi."}</T>
        </h2>
        <p>
          <T>
            {
              "Mai puține căutări, verificări și informații introduse de două ori. Estimează ce ar însemna pentru echipa ta un flux mai simplu."
            }
          </T>
        </p>
        <Link href="/cum-functioneaza" className="marketing-text-link">
          <T>{"Descoperă modul de lucru"}</T>
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="roi-calculator" data-reveal>
        <span className="marketing-eyebrow">
          <T>{"CALCULATOR ORIENTATIV"}</T>
        </span>
        <div className="roi-input">
          <div className="roi-label">
            <label htmlFor="roi-appointments">
              <T>{"Programări pe zi"}</T>
            </label>
            <output htmlFor="roi-appointments" aria-hidden="true">
              {appointments}
            </output>
          </div>
          <input
            id="roi-appointments"
            type="range"
            min={5}
            max={100}
            step={5}
            value={appointments}
            onChange={(event) => setAppointments(Number(event.target.value))}
          />
        </div>
        <div className="roi-input">
          <div className="roi-label">
            <label htmlFor="roi-minutes">
              <T>{"Minute economisite / programare"}</T>
            </label>
            <output htmlFor="roi-minutes" aria-hidden="true">
              {minutes}
            </output>
          </div>
          <input
            id="roi-minutes"
            type="range"
            min={1}
            max={15}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </div>
        <div
          className="roi-result"
          role="status"
          aria-label={`${hours} ore pe lună, estimare`}
        >
          <strong aria-hidden="true">
            <span ref={counter}>{hours}</span>
            <small>h</small>
          </strong>
          <span>
            <T>{"potențial economisite"}</T>
            <br />
            <T>{"în fiecare lună"}</T>
          </span>
        </div>
        <p className="roi-note">
          <T>
            {
              "Estimare pe baza valorilor alese și a 22 de zile lucrătoare. Nu reprezintă un rezultat garantat; timpul real depinde de activitatea clinicii."
            }
          </T>
        </p>
      </div>
    </section>
  );
}
