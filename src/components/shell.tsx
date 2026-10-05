"use client";
import { T, LocalizedElement } from "@/components/locale-provider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogOut,
  ChevronRight,
  ContactRound,
  Stethoscope,
  ClipboardList,
  Clock3,
  CalendarDays,
  Boxes,
} from "lucide-react";
import type { Clinic, Preferences } from "@/features/auth/access";
import { logout } from "@/features/auth/actions";
import { can } from "@/lib/permissions";
import { modulePermission } from "@/features/core-clinic/model";
import { Button } from "./ui/button";
import { Panel } from "./ui/dialog";
import { Hint } from "./ui/tooltip";
import { GlobalSearch } from "./global-search";
export function Shell({
  clinic,
  name,
  permissions,
  preferences,
  locations = [],
  children,
}: {
  clinic: Clinic;
  name: string;
  permissions: string[];
  preferences: Preferences | null;
  locations?: { id: string; name: string; organizationName: string }[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const base = `/clinics/${clinic.id}`;
  const workspaceLinks = [
    { href: base, label: "Spațiu de lucru", icon: Building2 },
    ...(can(permissions, "appointments.read")
      ? [{ href: `${base}/calendar`, label: "Calendar", icon: CalendarDays }]
      : []),
    ...(can(permissions, "results.manage") ? [{ href: `${base}/my-schedule`, label: "Programul meu", icon: CalendarDays }] : []),
    ...(can(permissions, modulePermission("patients", "read"))
      ? [{ href: `${base}/patients`, label: "Pacienți", icon: ContactRound }]
      : []),
    ...(can(permissions, "results.read")
      ? [{ href: `${base}/results`, label: "Rezultate", icon: ClipboardList }]
      : []),
    ...(can(permissions, modulePermission("doctors", "read"))
      ? [{ href: `${base}/doctors`, label: "Medici", icon: Stethoscope }]
      : []),
    ...(can(permissions, modulePermission("services", "read"))
      ? [{ href: `${base}/services`, label: "Servicii", icon: ClipboardList }]
      : []),
    ...(can(permissions, modulePermission("availability", "read"))
      ? [{ href: `${base}/availability`, label: "Disponibilitate", icon: Clock3 }]
      : []),
    ...(can(permissions, modulePermission("rooms", "read"))
      ? [{ href: `${base}/resources`, label: "Resurse", icon: Boxes }]
      : []),
  ];
  const adminLinks = [{ href: `${base}/settings`, label: "Setări", icon: Settings2 }];
  const links = [...workspaceLinks, ...adminLinks];
  const renderLinks = (items: typeof links) => items.map(({ href, label, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      title={collapsed ? label : undefined}
      className={path === href || (href !== base && path.startsWith(href + "/")) ? "nav-link active" : "nav-link"}
      aria-current={path === href || (href !== base && path.startsWith(href + "/")) ? "page" : undefined}
    >
      <Icon size={18} />
      <span className="nav-label"><T>{label}</T></span>
    </Link>
  ));
  const nav = (
    <LocalizedElement as="nav" aria-label="Navigație principală">
      <span className="nav-section-label"><T>{"SPAȚIU DE LUCRU"}</T></span>
      {renderLinks(workspaceLinks)}
      <span className="nav-section-label"><T>{"ADMINISTRARE"}</T></span>
      {renderLinks(adminLinks)}
    </LocalizedElement>
  );
  return (
    <div
      className={`app-shell ${collapsed ? "is-collapsed" : ""}`}
      data-density={preferences?.density ?? "compact"}
    >
      <a className="skip-link" href="#main"><T>{"Sari la conținut"}</T></a>
      <aside className="sidebar">
        <Link
          href="/"
          className="brand"
          aria-label="Voxa — pagina principală"
        >
          <span className="brand-mark"><T>{"V"}</T></span>
          <span className="brand-label"><T>{"VOXA"}</T></span>
        </Link>
        {nav}
        <div className="sidebar-bottom">
          <p className="sidebar-note"><T>{"INSTALARE CLINICĂ"}</T><br />
            <strong>{clinic.name}</strong>
          </p>
          <Hint text={collapsed ? "Extinde meniul" : "Restrânge meniul"}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </Button>
          </Hint>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-menu">
            <Panel
              key={path}
              title="VOXA"
              description="Administrare clinică"
              drawer
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Deschide meniul"
                >
                  <Menu size={20} />
                </Button>
              }
            >
              {nav}
            </Panel>
          </div>
          <div className="location single-clinic">
            <span className="topbar-label"><T>{"Locație"}</T></span>
            {locations.length > 1 ? <LocalizedElement as="select" className="input" aria-label="Schimbă locația" value={clinic.id} onChange={(e) => router.push(`/clinics/${e.target.value}`)}>{locations.map((l) => <option value={l.id} key={l.id}>{l.organizationName} · {l.name}</option>)}</LocalizedElement> : <strong>{clinic.name}</strong>}
          </div>
          <GlobalSearch clinicId={clinic.id} />
          <div className="topbar-user">
            <span className="user-avatar">
              {(name || "U").slice(0, 2).toUpperCase()}
            </span>
            <span className="user-name">{name || "Utilizator"}</span>
            <form action={logout}>
              <Hint text="Deconectare">
                <Button variant="ghost" size="icon" aria-label="Deconectare">
                  <LogOut size={17} />
                </Button>
              </Hint>
            </form>
          </div>
        </header>
        <div className="breadcrumb">
          <span><T>{"Administrare"}</T></span>
          <ChevronRight size={12} />
          <span>
            {links.find(
              (l) =>
                l.href === path ||
                (l.href !== base && path.startsWith(l.href + "/")),
            )?.label ?? "Clinică"}
          </span>
        </div>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span><T>{"VOXA"}</T></span>
          <Link href="/help"><T>{"Ajutor și suport"}</T></Link>
          <span>{clinic.timezone}</span>
        </footer>
      </div>
    </div>
  );
}
