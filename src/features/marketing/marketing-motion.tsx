"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate } from "motion/mini";

export function MarketingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements =
      root.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!elements) return;
    const animations: ReturnType<typeof animate>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            if (!media.matches) {
              const element = entry.target as HTMLElement;
              const group = element.parentElement?.hasAttribute("data-stagger");
              const index = group
                ? Array.from(element.parentElement!.children).indexOf(element)
                : 0;
              animations.push(
                animate(
                  element,
                  {
                    opacity: [0, 1],
                    transform: ["translateY(18px)", "translateY(0)"],
                  },
                  {
                    duration: 0.65,
                    delay: Math.min(index * 0.07, 0.28),
                    ease: [0.22, 1, 0.36, 1],
                  },
                ),
              );
            }
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    const showAll = () => {
      if (media.matches) {
        observer.disconnect();
        animations.forEach((animation) => animation.stop());
        elements.forEach((element) => {
          element.style.removeProperty("opacity");
          element.style.removeProperty("transform");
        });
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
      animations.forEach((animation) => animation.stop());
      media.removeEventListener("change", showAll);
    };
  }, []);
  return <div ref={root}>{children}</div>;
}
