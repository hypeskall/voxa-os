"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate } from "motion/mini";

export function MarketingMotion({
  children,
  cinematic = false,
}: {
  children: ReactNode;
  cinematic?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => !cinematic && media.matches;
    const elements = container.querySelectorAll<HTMLElement>("[data-reveal]");
    const animations: ReturnType<typeof animate>[] = [];
    const reveal = (element: HTMLElement) => {
      element.setAttribute("data-visible", "true");
      if (reduced()) return;
      const group = element.parentElement?.hasAttribute("data-stagger");
      const index = group
        ? Array.from(element.parentElement!.children).indexOf(element)
        : 0;
      const direction = element.dataset.reveal;
      const liveWorkspace = Boolean(element.querySelector(".cinema-interface"));
      const from = liveWorkspace
        ? "translate3d(0, 60px, 0)"
        : direction === "depth"
          ? "perspective(1000px) translate3d(0, 65px, -70px) rotateX(22deg)"
          : direction === "left"
            ? "translate3d(-48px, 28px, 0)"
            : direction === "right"
              ? "translate3d(48px, 28px, 0)"
              : direction === "scale"
                ? "translate3d(0, 56px, 0) scale(.94)"
                : cinematic
                  ? "translate3d(0, 48px, 0)"
                  : "translateY(18px)";
      animations.push(
        animate(
          element,
          {
            opacity: [0, 1],
            transform: [from, "translate3d(0, 0, 0) scale(1)"],
            ...(cinematic && !liveWorkspace
              ? { filter: ["blur(5px)", "blur(0px)"] }
              : {}),
          },
          {
            duration: cinematic ? 1.05 : 0.65,
            delay: Math.min(index * (cinematic ? 0.12 : 0.07), 0.48),
            ease: [0.16, 1, 0.3, 1],
          },
        ),
      );
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );
    elements.forEach((element) => {
      // Progressive enhancement: content stays readable without JavaScript.
      if (!reduced() && element.getBoundingClientRect().top > innerHeight) {
        element.setAttribute("data-visible", "false");
        observer.observe(element);
      }
    });

    const scenes = container.querySelectorAll<HTMLElement>(
      "[data-scroll-scene]",
    );
    const activeScenes = new Set<HTMLElement>();
    let frame = 0;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const update = () => {
      frame = 0;
      if (!cinematic || reduced()) return;
      const height = document.documentElement.scrollHeight - innerHeight;
      container.style.setProperty(
        "--page-progress",
        String(height > 0 ? clamp(scrollY / height) : 0),
      );
      for (const scene of activeScenes) {
        const rect = scene.getBoundingClientRect();
        const progress = clamp(
          (innerHeight - rect.top) / (innerHeight + rect.height),
        );
        scene.style.setProperty("--scene-progress", progress.toFixed(4));
      }
    };
    const schedule = () => {
      if (cinematic && !reduced() && !frame)
        frame = requestAnimationFrame(update);
    };
    const sceneObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const scene = entry.target as HTMLElement;
          if (entry.isIntersecting) activeScenes.add(scene);
          else activeScenes.delete(scene);
        }
        schedule();
      },
      { rootMargin: "20% 0px 20% 0px" },
    );
    if (cinematic) {
      scenes.forEach((scene) => sceneObserver.observe(scene));
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      schedule();
    }
    const showAll = () => {
      if (reduced()) {
        observer.disconnect();
        animations.forEach((animation) => animation.stop());
        elements.forEach((element) => {
          for (const property of ["opacity", "transform", "filter"])
            element.style.removeProperty(property);
          element.setAttribute("data-visible", "true");
        });
        scenes.forEach((scene) =>
          scene.style.removeProperty("--scene-progress"),
        );
      }
      schedule();
    };
    media.addEventListener("change", showAll);
    return () => {
      observer.disconnect();
      sceneObserver.disconnect();
      animations.forEach((animation) => animation.stop());
      cancelAnimationFrame(frame);
      media.removeEventListener("change", showAll);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [cinematic]);
  return (
    <div ref={root} className={cinematic ? "luxury-motion" : undefined}>
      {cinematic && (
        <div className="luxury-scroll-progress" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}
