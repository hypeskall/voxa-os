import Link from "next/link";
import { can } from "@/lib/permissions";
import { requireClinic } from "@/features/auth/access";
import { Section, Table } from "@/components/ui/page";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Select } from "@/components/ui/form";
import { localDate, formatInTimeZone } from "@/lib/time";
import { appointmentStatusLabels, notificationEventLabels, notificationStatusLabels } from "@/lib/locale/ro";
import { recordManualCommunication } from "./manual-communication-actions";

const channelLabels:Record<string,string>={PHONE:"Telefon",WHATSAPP:"WhatsApp",EMAIL:"Email",SMS:"SMS",IN_PERSON:"La recepție",OTHER:"Alt canal"};
const directionLabels:Record<string,string>={OUTBOUND:"Inițiată de clinică",INBOUND:"Inițiată de pacient"};

export async function PatientAppointments({cid,pid}:{cid:string;pid:string}){
  const {client,clinic}=await requireClinic(cid,"appointments.read");
  const {data,error}=await client.from("appointments").select("id,start_at,status").eq("clinic_id",cid).eq("patient_id",pid).order("start_at",{ascending:false}).limit(100);
  if(error)throw new Error("Programările pacientului nu au putut fi încărcate.");
  return <Section title="Programări"><Table><thead><tr><th>Data</th><th>Stare</th><th></th></tr></thead><tbody>{data?.map(a=><tr key={a.id}><td>{formatInTimeZone(a.start_at,clinic.timezone)}</td><td>{appointmentStatusLabels[a.status]??a.status}</td><td><Link className="text-link" href={`/clinics/${cid}/calendar?date=${localDate(clinic.timezone, new Date(a.start_at))}&appointment=${a.id}`}>Deschide în calendar</Link></td></tr>)}{!data?.length&&<tr><td colSpan={3} className="table-empty">Nu există programări.</td></tr>}</tbody></Table></Section>;
}

export async function PatientCommunications({cid,pid}:{cid:string;pid:string}){
  const {client,clinic,permissions}=await requireClinic(cid,"notifications.read");
  const [manual,technical]=await Promise.all([
    client.from("manual_patient_communications").select("id,channel,direction,summary,occurred_at").eq("clinic_id",cid).eq("patient_id",pid).order("occurred_at",{ascending:false}).limit(100),
    client.from("communication_logs").select("id,event,channel,status,recipient_masked,created_at").eq("clinic_id",cid).eq("patient_id",pid).order("created_at",{ascending:false}).limit(100),
  ]);
  if(manual.error||technical.error)throw new Error("Comunicările pacientului nu au putut fi încărcate.");
  const manage=can(permissions,"patients.manage");
  return <>
    <Section title="Comunicări" description="Apeluri, mesaje și discuții administrative cu pacientul.">
      {manage&&<div className="mb-5"><Panel drawer title="Înregistrează comunicare" description="Notați doar informații administrative, fără conținut medical." trigger={<Button>Adaugă comunicare</Button>}><ActionForm action={recordManualCommunication.bind(null,cid,pid)} submit="Înregistrează"><Field label="Canal"><Select name="channel" defaultValue="PHONE"><option value="PHONE">Telefon</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="IN_PERSON">La recepție</option><option value="OTHER">Alt canal</option></Select></Field><Field label="Direcție"><Select name="direction" defaultValue="OUTBOUND"><option value="OUTBOUND">Inițiată de clinică</option><option value="INBOUND">Inițiată de pacient</option></Select></Field><Field label="Rezumat administrativ"><textarea className="input textarea" name="summary" rows={5} required minLength={2} maxLength={1000} placeholder="Exemplu: pacientul a confirmat programarea telefonic." /></Field></ActionForm></Panel></div>}
      <Table><thead><tr><th>Data</th><th>Canal</th><th>Direcție</th><th>Rezumat</th></tr></thead><tbody>{manual.data?.map(item=><tr key={item.id}><td>{formatInTimeZone(item.occurred_at,clinic.timezone)}</td><td>{channelLabels[item.channel]??item.channel}</td><td>{directionLabels[item.direction]??item.direction}</td><td>{item.summary}</td></tr>)}{!manual.data?.length&&<tr><td colSpan={4} className="table-empty">Nu există comunicări înregistrate manual.</td></tr>}</tbody></Table>
    </Section>
    {!!technical.data?.length&&<Section title="Livrări automate" description="Istoricul tehnic al mesajelor generate de sistem."><Table><thead><tr><th>Data</th><th>Eveniment</th><th>Canal</th><th>Destinatar</th><th>Stare</th></tr></thead><tbody>{technical.data.map(item=><tr key={item.id}><td>{formatInTimeZone(item.created_at,clinic.timezone)}</td><td>{notificationEventLabels[item.event]??item.event}</td><td>{channelLabels[item.channel]??item.channel}</td><td>{item.recipient_masked}</td><td>{notificationStatusLabels[item.status]??item.status}</td></tr>)}</tbody></Table></Section>}
  </>;
}
