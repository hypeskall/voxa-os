"use client";
import { T, LocalizedElement } from "@/components/locale-provider";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { productMedia, type ProductMediaKey } from "./product-media";

const views = [
  {
    title: "Medici",
    heading: "Disponibilitatea începe cu echipa.",
    body: "Specialități, servicii și program de lucru pentru fiecare medic și locație.",
    src: "doctors",
  },
  {
    title: "Servicii",
    heading: "Fiecare serviciu, bine definit.",
    body: "Durată, preț și resurse necesare. Regulile de programare pornesc din aceeași configurare.",
    src: "services",
  },
  {
    title: "Echipă și acces",
    heading: "Roluri clare. Responsabilități clare.",
    body: "Invită colegii și gestionează accesul în clinică pentru administratori, recepție și medici.",
    src: "team",
  },
];

export function WorkspaceShowcase() {
  const [selected, setSelected] = useState(0);
  const view = views[selected];
  return (
    <div className="workspace-showcase" data-reveal>
      <div className="workspace-copy">
        <span className="marketing-eyebrow"><T>{"04 / CONFIGURARE ȘI ADMINISTRARE"}</T></span>
        <h3><T>{view.heading}</T></h3>
        <p><T>{view.body}</T></p>
        <LocalizedElement as="div"
          className="workspace-tabs"
          role="tablist"
          aria-label="Configurarea clinicii"
          aria-orientation="vertical"
        >
          {views.map((item, index) => (
            <button
              key={item.src}
              type="button"
              role="tab"
              id={`workspace-tab-${index}`}
              aria-controls="workspace-panel"
              aria-selected={selected === index}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                if (
                  !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? views.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          views.length) %
                        views.length;
                setSelected(next);
                document.getElementById(`workspace-tab-${next}`)?.focus();
              }}
            >
              <span><T>{item.title}</T></span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </LocalizedElement>
      </div>
      <div
        className="marketing-screen workspace-screen"
        id="workspace-panel"
        role="tabpanel"
        aria-labelledby={`workspace-tab-${selected}`}
        tabIndex={0}
      >
        <Image
          key={view.src}
          className="workspace-image"
          src={productMedia[view.src as ProductMediaKey]}
          alt={`${view.title} în Voxa-OS, cu date demonstrative`}
          width={1440}
          height={1000}
          sizes="(max-width: 760px) 720px, (max-width: 1100px) 90vw, 850px"
        />
      </div>
    </div>
  );
}
