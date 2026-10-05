"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ContactRound, FileText, Search, Stethoscope, ClipboardList } from "lucide-react";
import { z } from "zod";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const resultSchema = z.array(z.object({ kind:z.enum(["patient","doctor","appointment","service","document"]), id:z.uuid(), title:z.string(), subtitle:z.string(), href:z.string().startsWith("/") }));
type SearchResult = z.infer<typeof resultSchema>[number];
const labels = { patient:"Pacient", doctor:"Medic", appointment:"Programare", service:"Serviciu", document:"Document" } as const;
const icons = { patient:ContactRound, doctor:Stethoscope, appointment:CalendarDays, service:ClipboardList, document:FileText } as const;

export function GlobalSearch({clinicId}:{clinicId:string}) {
  const router=useRouter(); const [open,setOpen]=useState(false); const [query,setQuery]=useState("");
  const [results,setResults]=useState<SearchResult[]>([]); const [loading,setLoading]=useState(false); const [active,setActive]=useState(0); const requestRef=useRef<AbortController|null>(null);
  useEffect(()=>{ const onKey=(event:KeyboardEvent)=>{ if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setOpen(true);} }; window.addEventListener("keydown",onKey); return()=>window.removeEventListener("keydown",onKey); },[]);
  useEffect(()=>{
    if(!open||query.trim().length<2)return;
    const controller=new AbortController();requestRef.current=controller;
    const timeout=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const response=await fetch(`/api/clinics/${clinicId}/search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query}),signal:controller.signal});
        const payload:unknown=await response.json();
        if(controller.signal.aborted)return;
        const parsed=z.object({results:resultSchema}).safeParse(payload);
        setResults(response.ok&&parsed.success?parsed.data.results:[]);setActive(0);
      }catch{if(!controller.signal.aborted)setResults([]);}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },220);
    return()=>{window.clearTimeout(timeout);controller.abort();};
  },[clinicId,open,query]);
  function choose(item:SearchResult){requestRef.current?.abort();setOpen(false);setQuery("");setResults([]);setLoading(false);router.push(item.href);}
  return <Panel open={open} onOpenChange={(next)=>{setOpen(next);if(!next){requestRef.current?.abort();setQuery("");setResults([]);setLoading(false);}}} title="Căutare globală" description="Pacienți, medici, programări, servicii și documente accesibile în clinică." trigger={<Button variant="outline" className="global-search-trigger"><Search size={15}/><span>Caută în clinică</span><kbd>Ctrl K</kbd></Button>}>
    <div className="command-search" onKeyDown={(event)=>{if(event.key==="ArrowDown"){event.preventDefault();setActive(v=>Math.min(v+1,results.length-1));}if(event.key==="ArrowUp"){event.preventDefault();setActive(v=>Math.max(v-1,0));}if(event.key==="Enter"&&results[active]){event.preventDefault();choose(results[active]);}}}>
      <label className="search-field"><Search size={17}/><input className="input" autoFocus value={query} onChange={e=>{const value=e.target.value;requestRef.current?.abort();setQuery(value);setResults([]);setActive(0);setLoading(value.trim().length>=2);}} placeholder="Nume, identificator, serviciu…" aria-label="Termen de căutare" role="combobox" aria-expanded={results.length>0} aria-controls="global-results" aria-activedescendant={results[active]?`search-${results[active].kind}-${results[active].id}`:undefined}/></label>
      <div id="global-results" className="command-results" role="listbox" aria-label="Rezultate căutare">
        {results.map((item,index)=>{const Icon=icons[item.kind];return <button type="button" role="option" aria-selected={index===active} id={`search-${item.kind}-${item.id}`} className={index===active?"active":""} key={`${item.kind}-${item.id}`} onMouseEnter={()=>setActive(index)} onClick={()=>choose(item)}><Icon size={16}/><span><strong>{item.title}</strong><small>{labels[item.kind]} · {item.subtitle}</small></span></button>;})}
        {loading&&<p className="command-state">Se caută…</p>}{!loading&&query.trim().length>=2&&!results.length&&<p className="command-state">Nu există rezultate accesibile.</p>}{query.trim().length<2&&<p className="command-state">Introduceți cel puțin două caractere.</p>}
      </div>
    </div>
  </Panel>;
}
