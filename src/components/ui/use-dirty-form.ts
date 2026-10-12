"use client";
import { useEffect, type RefObject } from "react";
import { useLocale } from "@/components/locale-provider";
export function useDirtyFormGuard(
  ref: RefObject<HTMLFormElement | null>,
  pending = false,
) {
  const { t } = useLocale();
  useEffect(() => {
    if (ref.current) ref.current.dataset.pending = String(pending);
  }, [ref, pending]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (ref.current?.dataset.dirty === "true") event.preventDefault();
    };
    const guard = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        ref.current?.dataset.dirty !== "true"
      )
        return;
      const target = event.target;
      const link =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.getAttribute("href")?.startsWith("#")
      )
        return;
      if (
        !window.confirm(
          t(
            "Aveți modificări nesalvate. Părăsiți formularul și renunțați la ele?",
          ),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      } else delete ref.current.dataset.dirty;
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [ref, t]);
}
