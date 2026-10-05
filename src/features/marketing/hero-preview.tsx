"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  ContactRound,
  Maximize2,
  X,
  ArrowUpRight,
} from "lucide-react";
import { T, LocalizedElement } from "@/components/locale-provider";
import { productMedia } from "./product-media";

const views = [
  {
    key: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    caption: "Programul întregii echipe, într-o singură vedere.",
  },
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    caption: "O imagine clară a zilei. Știi ce are nevoie de atenție.",
  },
  {
    key: "patient-profile",
    label: "Pacient",
    icon: ContactRound,
    caption: "Date, documente și istoric, în același context.",
  },
] as const;

export function HeroPreview() {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const view = views[selected];
  useEffect(() => {
    // Keep the work area in view on phones; the full capture remains scrollable.
    if (frame.current)
      frame.current.scrollLeft = window.innerWidth <= 760 ? 128 : 0;
  }, [selected]);
  const select = (index: number, focus = false) => {
    setSelected(index);
    if (focus) document.getElementById(`hero-preview-tab-${index}`)?.focus();
  };
  return (
    <figure className="hero-product hero-enter premium-preview">
      <div className="preview-browser-bar" aria-hidden="true">
        <span className="preview-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span>
          VOXA-OS <span>/</span> <T>{"Spațiul clinicii tale"}</T>
        </span>
        <span className="preview-demo-label">
          <i />
          <T>{"PREVIEW PRODUS"}</T>
        </span>
      </div>
      <div className="preview-toolbar">
        <LocalizedElement
          as="div"
          className="preview-tabs"
          role="tablist"
          aria-label="Explorează interfața Voxa-OS"
        >
          {views.map(({ key, label, icon: Icon }, index) => (
            <button
              key={key}
              id={`hero-preview-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={selected === index}
              aria-controls="hero-preview-panel"
              tabIndex={selected === index ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                select(
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? views.length - 1
                      : (index +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          views.length) %
                        views.length,
                  true,
                );
              }}
            >
              <Icon size={15} />
              <T>{label}</T>
            </button>
          ))}
        </LocalizedElement>
        <LocalizedElement
          as="button"
          type="button"
          className="preview-expand"
          aria-label="Mărește previzualizarea"
          onClick={() => dialog.current?.showModal()}
        >
          <Maximize2 size={16} />
          <span>
            <T>{"Mărește"}</T>
          </span>
        </LocalizedElement>
      </div>
      <div
        ref={frame}
        id="hero-preview-panel"
        className="hero-screen-frame"
        role="tabpanel"
        aria-labelledby={`hero-preview-tab-${selected}`}
        tabIndex={0}
      >
        <Image
          key={view.key}
          src={productMedia[view.key]}
          alt={`${view.label} — interfața reală Voxa-OS, cu date demonstrative`}
          sizes="(max-width: 760px) 800px, (max-width: 1100px) 90vw, 820px"
          preload={selected === 0}
          className="preview-screen"
        />
      </div>
      <figcaption>
        <span>
          <T>{view.caption}</T>
        </span>
        <span>
          <T>{"Interfață reală · Date demonstrative"}</T>
          <ArrowUpRight size={13} />
        </span>
      </figcaption>
      <dialog
        ref={dialog}
        className="preview-dialog"
        aria-labelledby="preview-dialog-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="preview-dialog-heading">
          <h2 id="preview-dialog-title">
            <T>{view.label}</T>
            <span> / Voxa-OS</span>
          </h2>
          <LocalizedElement
            as="button"
            type="button"
            aria-label="Închide previzualizarea"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </LocalizedElement>
        </div>
        <div className="preview-dialog-image">
          <Image
            src={productMedia[view.key]}
            alt={`${view.label} în Voxa-OS — captură completă cu date demonstrative`}
            sizes="95vw"
          />
        </div>
        <p>
          <T>{"Interfața reală a platformei. Date demonstrative."}</T>
        </p>
      </dialog>
    </figure>
  );
}
