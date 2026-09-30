"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsNav({clinicId}:{clinicId:string}) {
  const path=usePathname(); const base=`/clinics/${clinicId}/settings`;
  const items=[{href:base,label:"General"},{href:`${base}/organization`,label:"Organizație"},{href:`${base}/security`,label:"Securitate"},{href:`${base}/portal`,label:"Portal și booking"}];
  return <nav className="settings-nav" aria-label="Categorii setări">{items.map(item=><Link key={item.href} href={item.href} aria-current={path===item.href?"page":undefined} className={path===item.href?"active":""}>{item.label}</Link>)}</nav>;
}
