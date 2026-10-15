"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
  type MotionStyle,
} from "motion/react";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  ContactRound,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { T } from "@/components/locale-provider";

const chapters = [
  {
    title: "O imagine clară a zilei.",
    body: "Programările, echipa și situațiile care cer atenție. Totul, într-un singur loc.",
    label: "Privire de ansamblu",
    icon: LayoutDashboard,
  },
  {
    title: "Fiecare programare își găsește locul.",
    body: "De la alegerea intervalului la confirmare. Un calendar care ține echipa în același ritm.",
    label: "Calendar & disponibilitate",
    icon: CalendarDays,
  },
  {
    title: "Pacientul. Cu tot contextul.",
    body: "Programări, documente și rezultate. Informația însoțește pacientul la fiecare pas.",
    label: "Profil pacient",
    icon: ContactRound,
  },
  {
    title: "Un singur spațiu. Pentru întreaga clinică.",
    body: "Recepția, medicul și administratorul. Perspective diferite, același context.",
    label: "Întreaga echipă",
    icon: ShieldCheck,
  },
] as const;

const people = [
  {
    name: "Ana Dumitrescu",
    initials: "AD",
    time: "09:00",
    service: "Consultație",
    confirmed: true,
  },
  {
    name: "Victor Popa",
    initials: "VP",
    time: "10:30",
    service: "Control",
    confirmed: false,
  },
  {
    name: "Maria Stan",
    initials: "MS",
    time: "12:00",
    service: "Investigație",
    confirmed: true,
  },
];

function Overview() {
  return (
    <div className="cinema-overview">
      <div className="cinema-stat-grid">
        {[
          ["Programări astăzi", "12", CalendarDays],
          ["Confirmate", "09", CheckCheck],
          ["În așteptare", "03", Clock3],
        ].map(([label, value, Icon]) => {
          const StatIcon = Icon as typeof CalendarDays;
          return (
            <div className="cinema-stat" key={String(label)}>
              <span>
                <T>{String(label)}</T>
                <StatIcon size={15} />
              </span>
              <strong>{String(value)}</strong>
              <small>
                <i />
                <T>{"Activitatea clinicii"}</T>
              </small>
            </div>
          );
        })}
      </div>
      <div className="cinema-insight-grid">
        <div className="cinema-chart">
          <div className="cinema-panel-title">
            <h4>
              <T>{"Săptămâna ta, în perspectivă."}</T>
            </h4>
            <span>19—23 OCT</span>
          </div>
          <div className="cinema-bars">
            {[64, 83, 55, 95, 72].map((height, index) => (
              <div key={index}>
                <span>{[8, 11, 7, 12, 9][index]}</span>
                <i style={{ height: `${height}%` }} />
                <small>
                  <T>{["Lun", "Mar", "Mie", "Joi", "Vin"][index]}</T>
                </small>
              </div>
            ))}
          </div>
        </div>
        <div className="cinema-team">
          <h4>
            <T>{"Echipa ta"}</T>
            <span>02</span>
          </h4>
          <div>
            <span className="cinema-avatar">EM</span>
            <p>
              <strong>Dr. Elena Marin</strong>
              <small>
                <T>{"Consultații"}</T>
              </small>
            </p>
            <i />
          </div>
          <div>
            <span className="cinema-avatar is-sand">RD</span>
            <p>
              <strong>Radu Dima</strong>
              <small>
                <T>{"Recepție"}</T>
              </small>
            </p>
            <i />
          </div>
          <span className="cinema-team-note">
            <Check size={12} />
            <T>{"Același context. În timp real."}</T>
          </span>
        </div>
      </div>
      <div className="cinema-recent">
        <div className="cinema-panel-title">
          <h4>
            <T>{"Următoarele programări"}</T>
          </h4>
          <span>
            <T>{"Vezi calendarul"}</T>
            <ArrowUpRight size={12} />
          </span>
        </div>
        {people.map((person) => (
          <div className="cinema-patient-row" key={person.name}>
            <span className="cinema-avatar">{person.initials}</span>
            <p>
              <strong>{person.name}</strong>
              <small>
                <T>{person.service}</T>
              </small>
            </p>
            <span
              className={`cinema-status ${person.confirmed ? "is-confirmed" : ""}`}
            >
              <i />
              <T>{person.confirmed ? "Confirmată" : "În așteptare"}</T>
            </span>
            <time>{person.time}</time>
          </div>
        ))}
      </div>
    </div>
  );
}

function Calendar({ progress }: { progress?: MotionValue<number> }) {
  const fallback = useSpring(0.4);
  const value = progress ?? fallback;
  const move = useTransform(value, [0.36, 0.54], [0, 1]);
  const elevation = useTransform(
    value,
    [0.36, 0.41, 0.49, 0.55],
    [0, 110, 110, 0],
  );
  const rotation = useTransform(value, [0.36, 0.43, 0.51, 0.55], [0, -5, 3, 0]);
  const shadow = useTransform(
    value,
    [0.36, 0.42, 0.5, 0.55],
    [
      "0px 3px 10px #173a3010",
      "0px 36px 45px #102f3045",
      "0px 36px 45px #102f3045",
      "0px 3px 10px #173a3010",
    ],
  );
  return (
    <div className="cinema-calendar-view">
      <div className="cinema-calendar-toolbar">
        <span>
          <CalendarDays size={13} />
          <T>{"19 — 23 octombrie"}</T>
        </span>
        <div>
          <b>
            <T>{"Săptămână"}</T>
          </b>
          <span>
            <T>{"Lună"}</T>
          </span>
        </div>
      </div>
      <div className="cinema-calendar-grid">
        <div className="cinema-hours">
          <span>GMT+3</span>
          {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"].map(
            (hour) => (
              <span key={hour}>{hour}</span>
            ),
          )}
        </div>
        {["Luni", "Marți", "Miercuri", "Joi", "Vineri"].map((day, index) => (
          <div className="cinema-day" key={day}>
            <div>
              <span>
                <T>{day}</T>
              </span>
              <strong>{19 + index}</strong>
            </div>
            <div className="cinema-day-cells">
              {Array.from({ length: 7 }, (_, hour) => (
                <i key={hour} />
              ))}
              {[0, 1, 3, 4].includes(index) && (
                <div
                  className={`cinema-calendar-event ${index === 1 ? "is-sand" : ""}`}
                  style={{ top: `${[54, 160, 0, 269, 108][index]}px` }}
                >
                  <span>{["09:00", "11:00", "", "13:00", "10:00"][index]}</span>
                  <strong>
                    {
                      ["Victor P.", "Maria S.", "", "Andrei P.", "Elena M."][
                        index
                      ]
                    }
                  </strong>
                  <small>
                    <T>{index === 1 ? "Control" : "Consultație"}</T>
                  </small>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="cinema-moving-area">
          <motion.div
            className="cinema-calendar-event is-moving"
            style={
              {
                "--move": move,
                z: elevation,
                rotateZ: rotation,
                boxShadow: shadow,
              } as MotionStyle
            }
          >
            <span>11:00 — 12:00</span>
            <strong>Ana Dumitrescu</strong>
            <small>
              <T>{"Consultație inițială"}</T>
            </small>
            <span className="cinema-event-check">
              <Check size={10} />
              <T>{"Interval disponibil"}</T>
            </span>
          </motion.div>
        </div>
      </div>
      <div className="cinema-calendar-legend">
        <span>
          <i />
          <T>{"Confirmate"}</T>
        </span>
        <span>
          <i />
          <T>{"În așteptare"}</T>
        </span>
        <span>
          <ShieldCheck size={11} />
          <T>{"Disponibilitate verificată"}</T>
        </span>
      </div>
    </div>
  );
}

function Patient() {
  return (
    <div className="cinema-patient-view">
      <div className="cinema-patient-hero">
        <span className="cinema-avatar is-large">AD</span>
        <div>
          <small>PACIENT / DEMO-001</small>
          <h4>Ana Dumitrescu</h4>
          <p>
            <T>{"Un profil. Întregul istoric."}</T>
          </p>
        </div>
        <span className="cinema-profile-active">
          <i />
          <T>{"Profil activ"}</T>
        </span>
      </div>
      <div className="cinema-patient-tabs">
        <span className="is-active">
          <T>{"Prezentare"}</T>
        </span>
        <span>
          <T>{"Programări"}</T>
        </span>
        <span>
          <T>{"Documente"}</T>
        </span>
        <span>
          <T>{"Rezultate"}</T>
        </span>
      </div>
      <div className="cinema-patient-content">
        <div className="cinema-history">
          <h4>
            <T>{"Istoricul programărilor"}</T>
            <span>03</span>
          </h4>
          {[
            ["19 OCT", "Consultație inițială", "Dr. Elena Marin"],
            ["12 OCT", "Control", "Dr. Elena Marin"],
            ["05 OCT", "Investigație", "Dr. Elena Marin"],
          ].map(([day, title, doctor]) => (
            <div key={day}>
              <span className="cinema-history-date">{day}</span>
              <div>
                <strong>
                  <T>{title}</T>
                </strong>
                <small>{doctor}</small>
              </div>
              <Check size={13} />
            </div>
          ))}
        </div>
        <div className="cinema-documents">
          <h4>
            <T>{"Documente & rezultate"}</T>
            <LockKeyhole size={12} />
          </h4>
          {["Rezultat investigație.pdf", "Fișă consultație.pdf"].map(
            (label, index) => (
              <div key={label}>
                <span className="cinema-file-icon">
                  <FileText size={19} strokeWidth={1.3} />
                </span>
                <p>
                  <strong>
                    <T>{label}</T>
                  </strong>
                  <small>{index ? "12 OCT 2026" : "19 OCT 2026"}</small>
                </p>
                <Check size={11} />
              </div>
            ),
          )}
          <p className="cinema-private-note">
            <ShieldCheck size={13} />
            <T>{"Disponibile colegilor autorizați."}</T>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProductInterface({
  scene = 0,
  progress,
}: {
  scene?: number;
  progress?: MotionValue<number>;
}) {
  const tab = scene === 1 ? "calendar" : scene === 2 ? "patient" : "dashboard";
  return (
    <div className="cinema-interface" aria-hidden="true">
      <div className="cinema-app-topbar">
        <div className="cinema-app-brand">
          <span>V</span> VOXA<span>-OS</span>
        </div>
        <span className="cinema-app-location">
          <i /> MERIDIAN / CLINICĂ DEMONSTRATIVĂ
        </span>
        <span className="cinema-app-search">
          <Search size={11} />
          <T>{"Caută în clinică"}</T>
          <kbd>⌘ K</kbd>
        </span>
        <span className="cinema-avatar is-user">AI</span>
      </div>
      <div className="cinema-app-shell">
        <aside>
          <span className="cinema-nav-caption">WORKSPACE</span>
          {[
            ["dashboard", "Dashboard", LayoutDashboard],
            ["calendar", "Calendar", CalendarDays],
            ["patient", "Pacienți", ContactRound],
            ["team", "Echipă", Stethoscope],
            ["files", "Documente", FileText],
          ].map(([key, title, Icon]) => {
            const NavIcon = Icon as typeof LayoutDashboard;
            return (
              <div key={String(key)} className={tab === key ? "is-active" : ""}>
                <NavIcon size={15} />
                <span>
                  <T>{String(title)}</T>
                </span>
                <i />
              </div>
            );
          })}
          <span className="cinema-sidebar-bottom">
            <LockKeyhole size={13} />
            <T>{"Spațiul clinicii tale"}</T>
          </span>
        </aside>
        <div className="cinema-app-main">
          <div className="cinema-page-title">
            <div>
              <small>
                MERIDIAN <ChevronRight size={9} /> <T>{"Spațiu de lucru"}</T>
              </small>
              <h3>
                <T>
                  {tab === "calendar"
                    ? "Calendarul echipei"
                    : tab === "patient"
                      ? "Pacientul, în context."
                      : "O zi bine organizată."}
                </T>
                <i />
              </h3>
            </div>
            <span className="cinema-app-action">
              <Plus size={12} />
              <T>{"Programare nouă"}</T>
            </span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              className="cinema-screen-content"
              initial={{ opacity: 0, x: 45, rotateY: -8 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -35, rotateY: 8 }}
              transition={{ duration: 0.35 }}
            >
              {tab === "calendar" ? (
                <Calendar progress={progress} />
              ) : tab === "patient" ? (
                <Patient />
              ) : (
                <Overview />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="cinema-app-bottom">
        <span>
          <i />
          <T>{"Date fictive · Prezentarea fluxului Voxa-OS"}</T>
        </span>
        <span>VOXA-OS / PRODUCT EXPERIENCE</span>
      </div>
    </div>
  );
}

export function ProductCinema() {
  const root = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: root,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 26,
    mass: 0.45,
  });
  const [chapter, setChapter] = useState(0);
  useMotionValueEvent(progress, "change", (value) =>
    setChapter(value < 0.28 ? 0 : value < 0.62 ? 1 : value < 0.85 ? 2 : 3),
  );
  const rotateY = useTransform(
    progress,
    [0, 0.18, 0.28, 0.43, 0.62, 0.75, 0.85, 1],
    [-23, 0, 0, 12, -12, 0, 0, -15],
  );
  const rotateX = useTransform(
    progress,
    [0, 0.18, 0.43, 0.62, 0.78, 1],
    [18, 0, 6, -6, 0, 6],
  );
  const roll = useTransform(
    progress,
    [0, 0.18, 0.45, 0.65, 0.8, 1],
    [-4, 0, -2, 2, 0, -3],
  );
  const y = useTransform(
    progress,
    [0, 0.18, 0.45, 0.65, 1],
    [75, 0, -15, 15, 45],
  );
  const scale = useTransform(
    progress,
    [0, 0.18, 0.5, 0.75, 1],
    [0.84, 1, 0.98, 1, 0.84],
  );
  const floatingY = useTransform(progress, [0, 1], [50, -55]);
  const layers = useTransform(progress, [0.84, 0.98], [0, 1]);
  const CurrentIcon = chapters[chapter].icon;
  return (
    <section
      ref={root}
      className="product-cinema"
      id="platforma"
      aria-labelledby="cinema-title"
      data-cinema-chapter={chapter}
    >
      <div className="cinema-sticky-stage">
        <div className="cinema-section-top">
          <span>
            <i /> VOXA-OS / <T>{"O perspectivă nouă."}</T>
          </span>
          <span>
            SCROLL EXPERIENCE <ArrowDown size={12} />
          </span>
        </div>
        <div className="cinema-stage-grid">
          <div className="cinema-chapter-copy">
            <div className="cinema-chapter-counter">
              <span>0{chapter + 1}</span>
              <span>/ 04</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={chapter}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <span className="cinema-chapter-label">
                  <CurrentIcon size={15} />
                  <T>{chapters[chapter].label}</T>
                </span>
                <h2 id="cinema-title">
                  <T>{chapters[chapter].title}</T>
                </h2>
                <p>
                  <T>{chapters[chapter].body}</T>
                </p>
              </motion.div>
            </AnimatePresence>
            <div className="cinema-chapter-rail" aria-hidden="true">
              {chapters.map((item, index) => (
                <span key={item.label} data-active={chapter === index}>
                  <i />0{index + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="cinema-camera">
            <div className="cinema-camera-grid" aria-hidden="true" />
            <motion.div
              className="cinema-rig"
              style={
                {
                  rotateX,
                  rotateY,
                  rotateZ: roll,
                  y,
                  scale,
                  "--cinema-progress": progress,
                } as MotionStyle
              }
            >
              <motion.div
                className="cinema-back-layer is-far"
                style={
                  { opacity: layers, "--layer-spread": layers } as MotionStyle
                }
              >
                <ProductInterface scene={1} />
              </motion.div>
              <motion.div
                className="cinema-back-layer"
                style={
                  { opacity: layers, "--layer-spread": layers } as MotionStyle
                }
              >
                <ProductInterface scene={2} />
              </motion.div>
              <div className="cinema-front-layer">
                <ProductInterface scene={chapter} progress={progress} />
              </div>
            </motion.div>
            <motion.div
              className="cinema-floating-signal"
              style={{ y: floatingY }}
            >
              <span>
                <ShieldCheck size={17} />
              </span>
              <div>
                <strong>
                  <T>
                    {chapter === 1
                      ? "Resurse verificate. Interval potrivit."
                      : chapter === 2
                        ? "Istoricul rămâne aproape."
                        : "O echipă. Același context."}
                  </T>
                </strong>
                <small>
                  <i />
                  <T>{"Voxa-OS, în mișcare."}</T>
                </small>
              </div>
              <Check size={13} />
            </motion.div>
          </div>
        </div>
        <div className="cinema-scroll-footer">
          <span>
            <ArrowDown size={14} />
            <T>{"Continuă să derulezi"}</T>
          </span>
          <div>
            <motion.span style={{ scaleX: progress }} />
          </div>
          <span>
            <T>{"Date fictive · Prezentarea fluxului Voxa-OS"}</T>
          </span>
        </div>
      </div>
    </section>
  );
}
