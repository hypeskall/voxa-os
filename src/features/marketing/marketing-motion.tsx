"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MarketingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements =
      root.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!elements) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    const showAll = () => {
      if (media.matches) {
        observer.disconnect();
        elements.forEach((element) =>
          element.setAttribute("data-visible", "true"),
        );
      }
    };
    if (!media.matches)
      elements.forEach((element) => {
        // Leave server-rendered content visible without JavaScript; animate only offscreen content.
        if (element.getBoundingClientRect().top > window.innerHeight) {
          element.setAttribute("data-visible", "false");
          observer.observe(element);
        }
      });
    media.addEventListener("change", showAll);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", showAll);
    };
  }, []);
  return <div ref={root}>{children}</div>;
}
