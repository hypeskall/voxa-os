"use client";
import { T, LocalizedElement } from "@/components/locale-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can } from "@/lib/permissions";

export function SettingsNav({clinicId,organizationId,permissions}:{clinicId:string;organizationId:string;permissions:string[]}) {
  const path=usePathname(); const base=`/clinics/${clinicId}/settings`;
  const items=[{href:base,label:"General"},...(can(permissions,"organization.manage")?[{href:`${base}/organization`,label:"Organizație"},{href:`${base}/privacy`,label:"Confidențialitate"}]:[]),{href:`${base}/security`,label:"Securitate"},...(can(permissions,"clinic.manage")?[{href:`${base}/portal`,label:"Portal și programare online"}]:[])];
  return <LocalizedElement as="nav" className="settings-nav" aria-label="Categorii setări">{items.map(item=><Link key={item.href} href={item.href} aria-current={path===item.href?"page":undefined} className={path===item.href?"active":""}><T>{item.label}</T></Link>)}{can(permissions,"organization.manage") && <Link href={`/organizations/${organizationId}/billing`}><T>{"Abonament și licență"}</T></Link>}</LocalizedElement>;
}
