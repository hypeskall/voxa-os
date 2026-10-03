"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { productMedia, type ProductMediaKey } from "./product-media";

const SCENE_MS = 4000;
const scenes = [
  {
    title: "Privire de ansamblu",
    src: "dashboard",
    caption: "Activitatea clinicii, într-un singur spațiu de lucru.",
    position: "50% 42%",
  },
  {
    title: "Calendar",
    src: "calendar",
    caption: "Programul echipei, organizat pe zile și intervale.",
    position: "55% 48%",
  },
  {
    title: "Programare",
    src: "appointment",
    caption: "Pacient, medic, resurse și status, în același context.",
    position: "90% 35%",
  },
  {
    title: "Pacient",
    src: "patient-profile",
    caption: "Date, programări și documente în profilul pacientului.",
    position: "60% 36%",
  },
  {
    title: "Servicii",
    src: "services",
    caption: "Serviciile clinicii și regulile lor de programare.",
    position: "58% 35%",
  },
  {
    title: "Spațiul de lucru",
    src: "dashboard",
    caption: "De la configurare la activitatea de zi cu zi.",
    position: "52% 42%",
  },
];

export function ProductShowcase({ videoSrc }: { videoSrc?: string }) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [readyScene, setReadyScene] = useState(-1);
  const [generation, setGeneration] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const timing = useRef({ scene: -1, generation: -1, remaining: SCENE_MS });
  const active = playing && visible && pageVisible && readyScene === selected;
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!active || videoSrc) return;
    if (
      timing.current.scene !== selected ||
      timing.current.generation !== generation
    )
      timing.current = { scene: selected, generation, remaining: SCENE_MS };
    const started = performance.now();
    let completed = false;
    const timer = window.setTimeout(() => {
      completed = true;
      if (selected === scenes.length - 1) {
        setPlaying(false);
        setFinished(true);
      } else setSelected(selected + 1);
    }, timing.current.remaining);
    return () => {
      window.clearTimeout(timer);
      if (
        !completed &&
        timing.current.scene === selected &&
        timing.current.generation === generation
      )
        timing.current.remaining = Math.max(
          0,
          timing.current.remaining - (performance.now() - started),
        );
    };
  }, [active, selected, generation, videoSrc]);
  const select = (index: number) => {
    setPlaying(false);
    setFinished(false);
    setSelected(index);
    // A deliberately selected chapter starts at its beginning.
    setGeneration((value) => value + 1);
  };
  const scene = scenes[selected];
  return (
    <div className="product-showcase" ref={root} data-playing={active}>
      {videoSrc ? (
        <video
          className="product-video"
          controls
          playsInline
          preload="none"
          poster={productMedia.dashboard.src}
        >
          <source src={videoSrc} />
          Browserul nu poate reda acest video.{" "}
          <a href={videoSrc}>Deschide prezentarea</a>
        </video>
      ) : (
        <>
          <div className="walkthrough-topline">
            <span>VOXA-OS / TURUL PLATFORMEI</span>
            <span>
              0{selected + 1} <span className="walkthrough-divider">/ 06</span>
            </span>
          </div>
          <div
            className="walkthrough-stage"
            id="product-panel"
            role="tabpanel"
            aria-labelledby={`product-tab-${selected}`}
            tabIndex={0}
          >
            <div
              key={`${selected}-${generation}-frame`}
              className="walkthrough-frame"
              style={{
                transformOrigin: scene.position,
                animationPlayState: active ? "running" : "paused",
              }}
            >
              <Image
                className="product-screen"
                src={productMedia[scene.src as ProductMediaKey]}
                width={1440}
                height={1000}
                alt={`${scene.title} în Voxa-OS, cu date demonstrative`}
                sizes="(max-width: 760px) 100vw, 1150px"
                onLoad={() => setReadyScene(selected)}
              />
            </div>
            {!playing && !finished && selected === 0 && (
              <button
                className="walkthrough-play-overlay"
                type="button"
                aria-label="Pornește prezentarea de 24 de secunde"
                onClick={() => setPlaying(true)}
              >
                <Play size={22} fill="currentColor" />
                <span>Vezi platforma în 24 secunde</span>
              </button>
            )}
          </div>
          {playing &&
            visible &&
            pageVisible &&
            selected < scenes.length - 1 && (
              <Image
                className="walkthrough-next-frame"
                src={productMedia[scenes[selected + 1].src as ProductMediaKey]}
                alt=""
                aria-hidden="true"
                width={1440}
                height={1000}
                loading="eager"
                sizes="(max-width: 760px) 100vw, 1150px"
              />
            )}
          <div className="walkthrough-toolbar">
            <div
              className="product-tabs"
              role="tablist"
              aria-label="Capitolele prezentării"
            >
              {scenes.map((item, index) => (
                <button
                  key={`${item.src}-${index}`}
                  type="button"
                  id={`product-tab-${index}`}
                  role="tab"
                  aria-selected={selected === index}
                  aria-controls="product-panel"
                  tabIndex={selected === index ? 0 : -1}
                  onClick={() => select(index)}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? scenes.length - 1
                          : (index +
                              (event.key === "ArrowRight" ? 1 : -1) +
                              scenes.length) %
                            scenes.length;
                    select(next);
                    document.getElementById(`product-tab-${next}`)?.focus();
                  }}
                >
                  <span className="chapter-track">
                    <span
                      key={
                        selected === index
                          ? `progress-${selected}-${generation}`
                          : "idle"
                      }
                      className={
                        index < selected || (finished && index === selected)
                          ? "is-complete"
                          : selected === index
                            ? "is-current"
                            : ""
                      }
                      style={{
                        animationPlayState: active ? "running" : "paused",
                      }}
                    />
                  </span>
                  <span className="chapter-label">
                    <small aria-hidden="true">0{index + 1}</small>
                    {item.title}
                  </span>
                </button>
              ))}
            </div>
            <button
              className="walkthrough-control"
              type="button"
              aria-pressed={playing}
              aria-label={
                finished
                  ? "Reia turul"
                  : playing
                    ? "Oprește turul"
                    : "Pornește turul"
              }
              onClick={() => {
                if (finished) {
                  setSelected(0);
                  setFinished(false);
                  setGeneration((value) => value + 1);
                }
                setPlaying(!playing);
              }}
            >
              {finished ? (
                <RotateCcw size={18} />
              ) : playing ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
            </button>
          </div>
        </>
      )}
      <div className="product-caption">
        <p>{videoSrc ? "Descoperă platforma în acțiune." : scene.caption}</p>
        <span>Interfață reală · Date demonstrative</span>
      </div>
    </div>
  );
}
