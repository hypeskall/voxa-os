import Link from "next/link";
import { z } from "zod";
import { formatInTimeZone } from "@/lib/time";
import { localToInstant } from "@/features/core-clinic/validation";
import { requireClinic, workspace } from "@/features/auth/access";
import { PageHeading, Table } from "@/components/ui/page";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";

export const metadata = { title: "Jurnal de audit" };
const actions: Record<string,string>={insert:"Creare",create:"Creare",update:"Modificare",login:"Conectare",archive:"Arhivare",restore:"Restaurare",cancel:"Anulare",reschedule:"Reprogramare",status:"Schimbare status",export:"Export"};
const entities: Record<string,string>={organizations:"Organizație",clinics:"Locație",clinic_memberships:"Acces utilizator",profiles:"Cont",patients:"Pacient",doctors:"Medic",services:"Serviciu",rooms:"Cabinet",equipment:"Echipament",appointments:"Programare",reports:"Raport",medical_results:"Rezultat medical",patient_documents:"Document"};
const filterSchema=z.object({page:z.coerce.number().int().min(1).max(10000).catch(1),clinic:z.uuid().optional(),actor:z.uuid().optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),action:z.string().max(60).optional(),entity:z.string().max(80).optional()});
function nextDate(value:string){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);}
function metadataSummary(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))return "—";const safe=new Set(["fields","source","duplicate_override","from","to","format","next_status","visible_to_patient","version"]);return Object.entries(value).filter(([key])=>safe.has(key)).map(([key,item])=>`${key}: ${Array.isArray(item)?item.join(", "):String(item)}`).join(" · ")||"—";}

export default async function Audit({params,searchParams}:{params:Promise<{clinicId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {clinicId}=await params;const base=await requireClinic(clinicId,"audit.read");const all=await workspace();const raw=await searchParams;
  const candidate=Object.fromEntries(Object.entries(raw).filter(([,v])=>typeof v==="string"&&v));const parsed=filterSchema.parse(candidate);
  const checks=await Promise.all(all.clinics.map(async clinic=>({clinic,grants:(await base.client.rpc("my_permissions",{cid:clinic.id})).data??[]})));
  const auditClinics=checks.filter(item=>can(item.grants,"audit.read")).map(item=>item.clinic);
  const selected=auditClinics.find(c=>c.id===parsed.clinic)??base.clinic;
  const {client}=await requireClinic(selected.id,"audit.read");
  let query=client.from("audit_logs").select("id,clinic_id,action,entity,entity_id,metadata,created_at,actor_id,profiles(full_name)",{count:"exact"}).eq("clinic_id",selected.id);
  if(parsed.actor)query=query.eq("actor_id",parsed.actor);if(parsed.action)query=query.eq("action",parsed.action);if(parsed.entity)query=query.eq("entity",parsed.entity);
  try{if(parsed.from)query=query.gte("created_at",localToInstant(`${parsed.from}T00:00`,selected.timezone));if(parsed.to)query=query.lt("created_at",localToInstant(`${nextDate(parsed.to)}T00:00`,selected.timezone));}catch{throw new Error("Intervalul de audit nu este valid.");}
  const [{data,error,count},{data:members,error:memberError}]=await Promise.all([query.order("created_at",{ascending:false}).order("id").range((parsed.page-1)*30,parsed.page*30-1),client.from("clinic_memberships").select("user_id,profiles(full_name)").eq("clinic_id",selected.id).order("created_at")]);
  if(error||memberError)throw new Error("Jurnalul nu a putut fi încărcat.");
  const qs=(page:number)=>{const out=new URLSearchParams();Object.entries({...parsed,page}).forEach(([key,value])=>{if(value!=null&&value!=="")out.set(key,String(value));});return `?${out}`;};
  return <><PageHeading eyebrow="SECURITATE" title="Jurnal de audit" description="Istoric imuabil al acțiunilor din locațiile la care aveți acces."/>
    <form className="audit-filters" method="get"><Field label="Locație"><Select name="clinic" defaultValue={selected.id}>{auditClinics.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Utilizator"><Select name="actor" defaultValue={parsed.actor??""}><option value="">Toți utilizatorii</option>{members?.map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||m.user_id.slice(0,8)}</option>)}</Select></Field><Field label="De la"><Input type="date" name="from" defaultValue={parsed.from}/></Field><Field label="Până la"><Input type="date" name="to" defaultValue={parsed.to}/></Field><Field label="Acțiune"><Select name="action" defaultValue={parsed.action??""}><option value="">Toate</option>{Object.entries(actions).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field><Field label="Entitate"><Select name="entity" defaultValue={parsed.entity??""}><option value="">Toate</option>{Object.entries(entities).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field><Button type="submit">Aplică filtrele</Button></form>
    <Table><thead><tr><th>Dată și oră</th><th>Utilizator</th><th>Acțiune</th><th>Entitate</th><th>Detalii sigure</th><th>Referință</th></tr></thead><tbody>{data?.map(r=><tr key={r.id}><td>{formatInTimeZone(r.created_at,selected.timezone)}</td><td>{r.profiles?.full_name||(r.actor_id?"Cont fără nume":"Sistem")}</td><td>{actions[r.action]??r.action}</td><td>{entities[r.entity]??r.entity}</td><td className="audit-metadata">{metadataSummary(r.metadata)}</td><td><span title={r.entity_id}>{r.entity_id.slice(0,8)}</span></td></tr>)}{!data?.length&&<tr><td colSpan={6} className="table-empty">Nu există evenimente pentru filtrele selectate.</td></tr>}</tbody></Table>
    <div className="pagination">{parsed.page>1?<Link className="text-link" href={qs(parsed.page-1)}>Pagina anterioară</Link>:<span/>}<span className="muted">Pagina {parsed.page}</span>{(count??0)>parsed.page*30?<Link className="text-link" href={qs(parsed.page+1)}>Pagina următoare</Link>:<span/>}</div><p className="note">Orele sunt afișate în fusul orar {selected.timezone}. Înregistrările nu pot fi modificate din aplicație.</p></>;
}
