"use client";
import { T, LocalizedElement, useLocale } from "@/components/locale-provider";
import { LiveRefresh } from "@/components/live-refresh";
import { addCalendarMonths } from "./model";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { DateFieldRo } from "@/components/ui/date-field-ro";
import { Hint } from "@/components/ui/tooltip";
import { PageHeading, Table } from "@/components/ui/page";
import type { Option } from "@/features/core-clinic/model";
import { localToInstant } from "@/features/core-clinic/validation";
import { appointmentStatuses } from "@/features/scheduling/model";
import {
  appointmentDetailAction,
  appointmentStatusAction,
  calendarRescheduleSlotsAction,
  cancelAppointmentAction,
  rescheduleAppointmentAction,
  resizeAppointmentAction,
  saveCalendarPreferencesAction,
  updateAppointmentNotesAction,
} from "./actions";
import { addCalendarDays, type AppointmentDetail, type CalendarAppointment, type CalendarFilters } from "./model";
import { AppointmentComposer } from "./appointment-composer";
import { calendarScale, minutesToClock, snapToIncrement, type CalendarTimeConfig } from "./time-grid";
import { appointmentEventLabels, appointmentSourceLabels, appointmentStatusLabels, formatRomanianDate } from "@/lib/locale/ro";
import { WhatsappReminderButton } from "./whatsapp-reminder-button";
import { TomorrowReminders } from "./tomorrow-reminders";
import type { WhatsappReminder } from "./whatsapp-reminders-model";

type View = "day" | "week" | "month" | "agenda";
type Options = Record<"doctors" | "specialities" | "services" | "rooms" | "equipment", Option[]>;
type CalendarSlot = { start_at:string; end_at:string; assignment:{doctor_id:string|null;room_id:string|null;equipment:{id:string}[]} };
// Intl formatters are expensive to construct, especially for a week of cards.
// Cache only formatting configuration, never clinic or patient data.
const localFormatters = new Map<string, Intl.DateTimeFormat>();
const clockFormatters = new Map<string, Intl.DateTimeFormat>();
function localParts(value: string, timeZone: string) {
  let formatter = localFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    localFormatters.set(timeZone, formatter);
  }
  const parts = formatter.format(new Date(value));
  return { date: parts.slice(0, 10), time: parts.slice(11, 16) };
}
function timeLabel(value: string, timeZone: string) {
  let formatter = clockFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("ro-RO", { timeZone, hour: "2-digit", minute: "2-digit" });
    clockFormatters.set(timeZone, formatter);
  }
  return formatter.format(new Date(value));
}
function dayLabel(date: string, timeZone: string, wide = false, locale = "ro") {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: wide ? "long" : "short", day: "2-digit", month: wide ? "long" : "short" }).format(new Date(`${date}T12:00:00Z`));
}
function dateList(start: string, end: string) {
  const values: string[] = [];
  for (let value = start; value < end; value = addCalendarDays(value, 1)) values.push(value);
  return values;
}

export function CalendarWorkspace({ clinicId, clinicName, clinicAddress, clinicPhone, whatsappTemplate, tomorrowReminders, tomorrowDate, appointments, range, timeZone, view, date, filters, options, canManage, canOverride, initialAppointment, incrementMinutes, visibleStart, visibleEnd }: {
  clinicId: string; clinicName: string; appointments: CalendarAppointment[]; range: { start: string; end: string }; timeZone: string;
  clinicAddress: string; clinicPhone: string; whatsappTemplate: string;
  tomorrowReminders: WhatsappReminder[]; tomorrowDate: string;
  view: View; date: string; filters: CalendarFilters; options: Options; canManage: boolean; canOverride: boolean; initialAppointment: string | null;
  incrementMinutes: number; visibleStart: string; visibleEnd: string;
}) {
  const { locale } = useLocale();

  const router = useRouter();
  const [items, setItems] = useState(appointments);
  const [selectedId, setSelectedId] = useState<string | null>(initialAppointment);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [createPrefill, setCreatePrefill] = useState<{ key: number; date: string; time: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const preferenceValue = JSON.stringify({ view, filters });
  const savedPreference = useRef(preferenceValue);
  const days = useMemo(() => dateList(range.start, range.end), [range]);
  useEffect(() => {
    queueMicrotask(() => setItems(appointments));
  }, [appointments]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    startTransition(async () => {
      const response = await appointmentDetailAction(clinicId, selectedId);
      if (!active) return;
      if (response.ok) setDetail(response.data as AppointmentDetail);
      else { setNotice(response.error); setSelectedId(null); }
    });
    return () => { active = false; };
  }, [clinicId, selectedId]);

  useEffect(() => {
    if (savedPreference.current === preferenceValue) return;
    // Persist only view/filter changes after navigation, never every date move.
    const timer = setTimeout(() => {
      savedPreference.current = preferenceValue;
      void saveCalendarPreferencesAction(clinicId, JSON.parse(preferenceValue)).then(result => {
        if (!result.ok) setNotice("Vizualizarea este deschisă, dar preferințele nu au putut fi salvate.");
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [clinicId, preferenceValue]);

  function navigate(nextView: View, nextDate = date, nextFilters = filters) {
    setCreatePrefill(null);
    const params = new URLSearchParams({ view: nextView, date: nextDate });
    // Include empty filters so Reset cannot restore older saved filters.
    Object.entries(nextFilters).forEach(([key, value]) => params.set(key, value));
    startTransition(() => {
      router.push(`/clinics/${clinicId}/calendar?${params}`);
    });
  }
  function move(direction: number) {
    const amount = view === "day" ? 1 : view === "agenda" ? 14 : 7;
    navigate(view, view === "month" ? addCalendarMonths(date, direction) : addCalendarDays(date, direction * amount));
  }
  async function dropAppointment(appointmentId: string, targetDate: string, targetTime: string) {
    const current = items.find((item) => item.id === appointmentId);
    if (!current) return;
    let startAt: string;
    try { startAt = localToInstant(`${targetDate}T${targetTime}`, timeZone); }
    catch { return setNotice("Ora aleasă nu este validă în fusul clinicii."); }
    const duration = Date.parse(current.end_at) - Date.parse(current.start_at);
    const optimistic = { ...current, start_at: startAt, end_at: new Date(Date.parse(startAt) + duration).toISOString() };
    setItems((all) => all.map((item) => item.id === current.id ? optimistic : item));
    const response = await rescheduleAppointmentAction(clinicId, current.id, {
      start_at: startAt, doctor_id: current.doctor_location_id, room_id: null, equipment_ids: [], expected_updated_at: current.updated_at,
    });
    if (!response.ok) {
      setItems((all) => all.map((item) => item.id === current.id ? current : item));
      setNotice(response.error);
    } else {
      setNotice("Programarea a fost mutată și resursele au fost reverificate.");
      router.refresh();
    }
  }
  async function resizeCalendarAppointment(appointmentId: string, durationMinutes: number) {
    const current = items.find((item) => item.id === appointmentId);
    if (!current) return;
    const optimistic = { ...current, end_at: new Date(Date.parse(current.start_at) + durationMinutes * 60_000).toISOString() };
    setItems((all) => all.map((item) => item.id === current.id ? optimistic : item));
    const response = await resizeAppointmentAction(clinicId, current.id, {
      duration_minutes: durationMinutes,
      expected_updated_at: current.updated_at,
    });
    if (!response.ok) {
      setItems((all) => all.map((item) => item.id === current.id ? current : item));
      setNotice(response.error);
    } else {
      setNotice(`Durata programării a fost actualizată la ${durationMinutes} minute.`);
      router.refresh();
    }
  }
  function openAppointment(id: string) { setDetail(null); setSelectedId(id); }

  return <>
    <LiveRefresh timeZone={timeZone} selectedDate={date} />
    <PageHeading eyebrow={clinicName.toUpperCase()} title="Calendar" description="Programări și disponibilitate operațională în timp real." action={canManage ? <AppointmentComposer key={date} clinicId={clinicId} timeZone={timeZone} services={options.services} doctors={options.doctors} rooms={options.rooms} equipment={options.equipment} initialDate={date} incrementMinutes={incrementMinutes} visibleStart={visibleStart} visibleEnd={visibleEnd} canOverride={canOverride} prefill={createPrefill} onCreated={(message) => { setNotice(message); router.refresh(); }} onOpenAppointment={openAppointment} /> : undefined} />
    <section className="calendar-shell" aria-busy={isPending}>
      <div className="calendar-toolbar">
        {canManage && <TomorrowReminders clinicId={clinicId} clinicName={clinicName} clinicAddress={clinicAddress} clinicPhone={clinicPhone} template={whatsappTemplate} timeZone={timeZone} date={tomorrowDate} reminders={tomorrowReminders} />}
        <div className="calendar-nav"><Button variant="outline" onClick={() => navigate(view, new Intl.DateTimeFormat("sv-SE", { timeZone }).format(new Date()))}><T>{"Astăzi"}</T></Button><Button variant="outline" size="icon" aria-label="Perioada anterioară" onClick={() => move(-1)}><ChevronLeft size={17} /></Button><Button variant="outline" size="icon" aria-label="Perioada următoare" onClick={() => move(1)}><ChevronRight size={17} /></Button><strong>{dayLabel(range.start,timeZone,true,locale)} – {dayLabel(addCalendarDays(range.end, -1),timeZone,true,locale)}</strong></div>
        <LocalizedElement as="div" className="calendar-view-switch" aria-label="Vizualizare calendar">{(["day", "week", "month", "agenda"] as const).map((value) => <Button key={value} size="sm" variant={view === value ? "default" : "ghost"} onClick={() => navigate(value)}>{({ day: "Zi", week: "Săptămână", month: "Lună", agenda: "Agendă" })[value]}</Button>)}</LocalizedElement>
      </div>
      <CalendarFiltersBar key={JSON.stringify(filters)} filters={filters} options={options} onApply={(next) => navigate(view, date, next)} />
      {notice && <div className="calendar-notice" role="status"><span><T>{notice}</T></span><LocalizedElement as="button" type="button" onClick={() => setNotice("")} aria-label="Închide mesajul">×</LocalizedElement></div>}
      {view === "month" ? <MonthView days={days} items={items} timeZone={timeZone} onOpen={openAppointment} /> : view === "agenda" ? <AgendaView items={items} timeZone={timeZone} onOpen={openAppointment} /> : <TimeGrid days={view === "day" ? [date] : days} items={items} timeZone={timeZone} canManage={canManage} dragging={dragging} setDragging={setDragging} onDrop={dropAppointment} onResize={resizeCalendarAppointment} onOpen={openAppointment} onCreate={(day,time) => setCreatePrefill({ key: Date.now(), date: day, time })} config={{ incrementMinutes, visibleStart, visibleEnd }} />}
    </section>
    <AppointmentDrawer clinicId={clinicId} clinicName={clinicName} clinicAddress={clinicAddress} clinicPhone={clinicPhone} whatsappTemplate={whatsappTemplate} detail={detail} loading={!!selectedId && !detail} timeZone={timeZone} doctors={options.doctors} open={!!selectedId} canManage={canManage} incrementMinutes={incrementMinutes} visibleStart={visibleStart} visibleEnd={visibleEnd} onOpenChange={(open) => { if (!open) { setSelectedId(null); setDetail(null); } }} onChanged={(message) => { setNotice(message); setSelectedId(null); setDetail(null); router.refresh(); }} />
  </>;
}

function CalendarFiltersBar({ filters, options, onApply }: { filters: CalendarFilters; options: Options; onApply: (filters: CalendarFilters) => void }) {
  const [value, setValue] = useState(filters);
  const fields: [keyof CalendarFilters, string, Option[]][] = [["doctor_id","Medic",options.doctors],["speciality_id","Specialitate",options.specialities],["service_id","Serviciu",options.services],["room_id","Cabinet",options.rooms],["equipment_id","Echipament",options.equipment]];
  return <div className="calendar-filters"><span className="filter-label"><SlidersHorizontal size={15} /><T>{"Filtre"}</T></span>{fields.map(([key,label,entries]) => <Select key={key} aria-label={label} value={value[key]} onChange={(event) => { const next = { ...value, [key]: event.target.value }; setValue(next); onApply(next); }}><option value=""><T>{label}</T><T>{": toate"}</T></option>{entries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>)}<Select aria-label="Status" value={value.status} onChange={(event) => { const next = { ...value, status: event.target.value as CalendarFilters["status"] }; setValue(next); onApply(next); }}><option value=""><T>{"Status: toate"}</T></option>{appointmentStatuses.map((status) => <option key={status} value={status}><T>{appointmentStatusLabels[status]}</T></option>)}</Select><Button variant="ghost" size="sm" onClick={() => { const empty: CalendarFilters = { doctor_id:"",speciality_id:"",service_id:"",room_id:"",equipment_id:"",status:"" }; setValue(empty); onApply(empty); }}><RotateCcw size={14} /><T>{"Resetează"}</T></Button></div>;
}

function TimeGrid({ days, items, timeZone, canManage, dragging, setDragging, onDrop, onResize, onOpen, onCreate, config }: { days: string[]; items: CalendarAppointment[]; timeZone: string; canManage: boolean; dragging: string | null; setDragging: (id: string | null) => void; onDrop: (id: string,date: string,time: string) => void; onResize: (id: string,durationMinutes: number) => void; onOpen: (id: string) => void; onCreate: (date:string,time:string)=>void; config: CalendarTimeConfig }) {
  const { locale } = useLocale();

  const scale = calendarScale(config);
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60_000);return()=>clearInterval(timer);},[]);
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone}).format(now);
  const nowTime=localParts(now.toISOString(),timeZone).time.split(":").map(Number);
  const nowMinute=nowTime[0]*60+nowTime[1];
  const labels: number[] = [];
  for (let minute = scale.startMinute; minute <= scale.endMinute; minute += 60) labels.push(minute);
  if (labels.at(-1) !== scale.endMinute) labels.push(scale.endMinute);
  return <div className="time-grid-scroll"><div className="time-grid" style={{ minWidth: `${Math.max(900, days.length * 166 + 72)}px`, gridTemplateColumns: `72px repeat(${days.length}, minmax(166px, 1fr))`, gridTemplateRows: `58px ${scale.height}px` }}>
    <div className="time-corner" />{days.map((day) => { const weekend=[0,6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()); return <div key={day} className={`time-day-heading ${day===today?"is-today":""} ${weekend?"is-weekend":""}`}><strong>{dayLabel(day,timeZone,false,locale)}</strong><small>{formatRomanianDate(day)}</small></div>; })}
    <div className="time-labels">{labels.map((minute) => <span key={minute} style={{ top: `${((minute-scale.startMinute)/scale.totalMinutes)*100}%` }}>{minutesToClock(minute)}</span>)}</div>
    {days.map((day) => <DayColumn key={day} day={day} items={items.filter((item) => localParts(item.start_at,timeZone).date===day)} timeZone={timeZone} canManage={canManage} dragging={dragging} setDragging={setDragging} onDrop={onDrop} onResize={onResize} onOpen={onOpen} onCreate={onCreate} nowMinute={day===today?nowMinute:null} config={config} />)}
  </div></div>;
}

function DayColumn({ day, items, timeZone, canManage, dragging, setDragging, onDrop, onResize, onOpen, onCreate, nowMinute, config }: { day: string; items: CalendarAppointment[]; timeZone: string; canManage: boolean; dragging: string | null; setDragging: (id:string|null)=>void; onDrop:(id:string,date:string,time:string)=>void; onResize:(id:string,durationMinutes:number)=>void; onOpen:(id:string)=>void; onCreate:(date:string,time:string)=>void; nowMinute:number|null; config:CalendarTimeConfig }) {
  const scale = calendarScale(config);
  const [dragPreview,setDragPreview]=useState<string|null>(null);
  const slots = Array.from({ length: scale.slotCount }, (_, index) => index);
  const lanes = useMemo(() => {
    const ends: number[] = [];
    const result = new Map<string, number>();
    [...items].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)).forEach((item) => {
      const start = Date.parse(item.start_at);
      let lane = ends.findIndex((end) => end <= start);
      if (lane < 0) { lane = ends.length; ends.push(0); }
      ends[lane] = Date.parse(item.end_at);
      result.set(item.id, lane);
    });
    return { map: result, count: Math.max(1, ends.length) };
  }, [items]);
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/appointment") || dragging;
    if (id) {
      const rect = event.currentTarget.getBoundingClientRect();
      const rawMinute = scale.startMinute + ((event.clientY - rect.top) / rect.height) * scale.totalMinutes;
      const minute = Math.max(scale.startMinute, Math.min(scale.endMinute - config.incrementMinutes, scale.startMinute + snapToIncrement(rawMinute - scale.startMinute, config.incrementMinutes)));
      const time = minutesToClock(minute);
      onDrop(id, day, time);
    }
    setDragging(null); setDragPreview(null);
  }
  function updateDragPreview(event:React.DragEvent<HTMLDivElement>){if(!canManage)return;event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();const raw=scale.startMinute+((event.clientY-rect.top)/rect.height)*scale.totalMinutes;setDragPreview(minutesToClock(Math.max(scale.startMinute,Math.min(scale.endMinute-config.incrementMinutes,scale.startMinute+snapToIncrement(raw-scale.startMinute,config.incrementMinutes)))));}
  const weekend=[0,6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
  const nowTop=nowMinute!==null&&nowMinute>=scale.startMinute&&nowMinute<=scale.endMinute?((nowMinute-scale.startMinute)/scale.totalMinutes)*scale.height:null;
  const hourHeight=scale.height/(scale.totalMinutes/60);
  return <div className={`time-day-column ${dragging ? "is-dragging" : ""} ${nowMinute!==null?"is-today":""} ${weekend?"is-weekend":""}`} style={{ height: scale.height, gridTemplateRows: `repeat(${scale.slotCount}, ${scale.height/scale.slotCount}px)`, backgroundImage:"linear-gradient(to bottom, transparent calc(100% - 1px), #cfd6d0 calc(100% - 1px)), linear-gradient(to bottom, transparent calc(100% - 1px), #ebeeea calc(100% - 1px))", backgroundSize:`100% ${hourHeight}px, 100% ${hourHeight/2}px` }} onDragOver={updateDragPreview} onDragLeave={()=>setDragPreview(null)} onDrop={handleDrop}>
    {slots.map((index) => { const time = minutesToClock(scale.startMinute + index * config.incrementMinutes); return <LocalizedElement as="button" type="button" key={time} className="calendar-drop-slot" data-date={day} data-time={time} aria-label={`Programare nouă la ${formatRomanianDate(day)} ${time}`} onClick={()=>{if(canManage&&!dragging)onCreate(day,time);}} />; })}
    {nowTop!==null&&<div className="current-time-line" style={{top:nowTop}}><span>{minutesToClock(nowMinute!)}</span></div>}
    {dragPreview&&<div className="drag-time-preview"><T>{"Ora nouă: "}</T>{dragPreview}</div>}
    {items.map((item) => <AppointmentBlock key={item.id} item={item} timeZone={timeZone} canManage={canManage} lane={lanes.map.get(item.id)??0} laneCount={lanes.count} scale={scale} incrementMinutes={config.incrementMinutes} setDragging={setDragging} onOpen={onOpen} onResize={onResize} />)}
  </div>;
}

function AppointmentBlock({ item,timeZone,canManage,lane,laneCount,scale,incrementMinutes,setDragging,onOpen,onResize }:{item:CalendarAppointment;timeZone:string;canManage:boolean;lane:number;laneCount:number;scale:ReturnType<typeof calendarScale>;incrementMinutes:number;setDragging:(id:string|null)=>void;onOpen:(id:string)=>void;onResize:(id:string,duration:number)=>void}) {
  const startParts=localParts(item.start_at,timeZone).time.split(":").map(Number);
  const startMinute=startParts[0]*60+startParts[1];
  const originalDuration=Math.max(5,Math.round((Date.parse(item.end_at)-Date.parse(item.start_at))/60000));
  const [previewDuration,setPreviewDuration]=useState<number|null>(null);
  const duration=previewDuration??originalDuration;
  const top=Math.max(0,((startMinute-scale.startMinute)/scale.totalMinutes)*scale.height);
  const height=Math.max(22,(duration/scale.totalMinutes)*scale.height);
  const resizable=canManage&&!['CANCELLED','COMPLETED','NO_SHOW'].includes(item.status);
  function beginResize(event:React.PointerEvent<HTMLSpanElement>){
    event.preventDefault(); event.stopPropagation();
    const origin=event.clientY; const pixelsPerMinute=scale.height/scale.totalMinutes;
    let nextDuration=originalDuration;
    const move=(moveEvent:PointerEvent)=>{
      const rawDuration=originalDuration+(moveEvent.clientY-origin)/pixelsPerMinute;
      nextDuration=Math.max(incrementMinutes,Math.min(scale.endMinute-startMinute,snapToIncrement(rawDuration,incrementMinutes)));
      setPreviewDuration(nextDuration);
    };
    const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);setPreviewDuration(null);if(nextDuration!==originalDuration)onResize(item.id,nextDuration);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});
  }
  const endLabel=minutesToClock(startMinute+duration);
  return <Hint text={`${item.patient_name} · ${item.service_name} · ${item.doctor_name||"Medic nealocat"} · ${timeLabel(item.start_at,timeZone)}–${endLabel} · ${appointmentStatusLabels[item.status]}`}><LocalizedElement as="div" role="button" tabIndex={0} draggable={canManage&&item.status!=="CANCELLED"} onDragStart={(event)=>{event.dataTransfer.setData("text/appointment",item.id);setDragging(item.id);}} onDragEnd={()=>setDragging(null)} onClick={()=>onOpen(item.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onOpen(item.id);}}} className={`appointment-card status-${item.status.toLowerCase()} ${previewDuration?"is-resizing":""}`} style={{borderLeftColor:item.doctor_color,top,height,left:`calc(${(lane/laneCount)*100}% + 3px)`,width:`calc(${100/laneCount}% - 6px)`}} aria-label={`${item.patient_name}, ${timeLabel(item.start_at,timeZone)}–${endLabel}, ${item.service_name}`}>
    <span className="appointment-time">{timeLabel(item.start_at,timeZone)}–{endLabel}</span><strong>{item.patient_name}</strong><small>{item.service_name}</small><small>{[item.doctor_name,item.room_name].filter(Boolean).join(" · ")}</small><i><span className="status-dot" /><T>{appointmentStatusLabels[item.status]}</T></i>
    {resizable&&<LocalizedElement as="span" role="slider" tabIndex={0} className="appointment-resize-handle" aria-label="Durata programării" aria-valuemin={incrementMinutes} aria-valuemax={scale.endMinute-startMinute} aria-valuenow={duration} aria-valuetext={`${duration} minute`} onPointerDown={beginResize} onClick={(event)=>event.stopPropagation()} onKeyDown={(event)=>{event.stopPropagation();if(event.key==="ArrowDown")onResize(item.id,Math.min(scale.endMinute-startMinute,(Math.floor(originalDuration/incrementMinutes)+1)*incrementMinutes));if(event.key==="ArrowUp"&&originalDuration>incrementMinutes)onResize(item.id,Math.max(incrementMinutes,(Math.ceil(originalDuration/incrementMinutes)-1)*incrementMinutes));}} />}
  </LocalizedElement></Hint>;
}

function MonthView({ days, items, timeZone, onOpen }: { days:string[];items:CalendarAppointment[];timeZone:string;onOpen:(id:string)=>void }) {
  const { locale } = useLocale();
 return <div className="month-grid">{days.map((day)=>{const dayItems=items.filter((item)=>localParts(item.start_at,timeZone).date===day);return <div className="month-day" key={day}><div className="month-date"><span>{dayLabel(day,timeZone,false,locale)}</span><strong>{day.slice(-2)}</strong></div>{dayItems.slice(0,4).map((item)=><button type="button" key={item.id} className={`month-appointment status-${item.status.toLowerCase()}`} onClick={()=>onOpen(item.id)}><time>{timeLabel(item.start_at,timeZone)}</time><span>{item.patient_name}</span></button>)}{dayItems.length>4&&<small>+{dayItems.length-4}<T>{" programări"}</T></small>}</div>;})}</div>; }

function AgendaView({ items,timeZone,onOpen }:{items:CalendarAppointment[];timeZone:string;onOpen:(id:string)=>void}) {
  const { locale } = useLocale();
 return <Table><thead><tr><th><T>{"Data"}</T></th><th><T>{"Ora"}</T></th><th><T>{"Pacient"}</T></th><th><T>{"Serviciu"}</T></th><th><T>{"Medic"}</T></th><th><T>{"Cabinet"}</T></th><th><T>{"Status"}</T></th></tr></thead><tbody>{items.map((item)=><tr key={item.id} onClick={()=>onOpen(item.id)} className="clickable-row"><td>{dayLabel(localParts(item.start_at,timeZone).date,timeZone,true,locale)}</td><td>{timeLabel(item.start_at,timeZone)}</td><td><strong>{item.patient_name}</strong></td><td>{item.service_name}</td><td>{item.doctor_name||"—"}</td><td>{item.room_name||"—"}</td><td><span className={`appointment-status status-${item.status.toLowerCase()}`}><T>{appointmentStatusLabels[item.status]}</T></span></td></tr>)}</tbody></Table>; }

function AppointmentDrawer({ clinicId,clinicName,clinicAddress,clinicPhone,whatsappTemplate,detail,loading,timeZone,doctors,open,canManage,incrementMinutes,visibleStart,visibleEnd,onOpenChange,onChanged }:{clinicId:string;clinicName:string;clinicAddress:string;clinicPhone:string;whatsappTemplate:string;detail:AppointmentDetail|null;loading:boolean;timeZone:string;doctors:Option[];open:boolean;canManage:boolean;incrementMinutes:number;visibleStart:string;visibleEnd:string;onOpenChange:(open:boolean)=>void;onChanged:(message:string)=>void}) {
  const { locale } = useLocale();

  const [error,setError]=useState(""); const [pending,startTransition]=useTransition();
  if (loading||!detail) return <Panel open={open} onOpenChange={onOpenChange} title="Programare" description="Se încarcă…" drawer trigger={<button type="button" hidden aria-hidden />}><LocalizedElement as="div" className="drawer-skeleton" aria-label="Se încarcă programarea"><span/><span/><span/><span/></LocalizedElement></Panel>;
  const local=localParts(detail.start_at,timeZone);const tomorrow=addCalendarDays(new Intl.DateTimeFormat("sv-SE",{timeZone}).format(new Date()),1)===local.date;
  const variables={patient_first_name:detail.patient_name.trim().split(/\s+/)[0]||detail.patient_name,patient_name:detail.patient_name,date:formatRomanianDate(local.date),time:timeLabel(detail.start_at,timeZone),service_name:detail.service_name,doctor_name:detail.doctor_name||"",clinic_name:clinicName,clinic_address:clinicAddress,clinic_phone:clinicPhone};
  return <Panel open={open} onOpenChange={onOpenChange} title={detail.patient_name} description={`${detail.service_name} · ${timeLabel(detail.start_at,timeZone)}`} drawer trigger={<button type="button" hidden aria-hidden />}><div className="appointment-drawer"><div className="appointment-summary"><span className={`appointment-status status-${detail.status.toLowerCase()}`}><T>{appointmentStatusLabels[detail.status]}</T></span><h3>{detail.patient_name}</h3><p>{[detail.patient_phone,detail.patient_email].filter(Boolean).join(" · ")||"Contact necompletat"}</p><Link href={`/clinics/${clinicId}/patients/${detail.patient_id}`}><T>{"Deschide pacientul"}</T></Link></div>{canManage&&<WhatsappReminderButton clinicId={clinicId} appointmentId={detail.id} phone={detail.patient_phone} template={whatsappTemplate} variables={variables} recommended={tomorrow}/>}<dl className="detail-grid compact"><div><dt><T>{"DATA"}</T></dt><dd>{dayLabel(local.date,timeZone,true,locale)}</dd></div><div><dt><T>{"ORA"}</T></dt><dd>{timeLabel(detail.start_at,timeZone)}–{timeLabel(detail.end_at,timeZone)}</dd></div><div><dt><T>{"DURATĂ"}</T></dt><dd>{detail.duration_minutes}<T>{" minute"}</T></dd></div><div><dt><T>{"MEDIC"}</T></dt><dd>{detail.doctor_name||"Nealocat"}</dd></div><div><dt><T>{"SURSĂ"}</T></dt><dd><T>{appointmentSourceLabels[detail.source]||detail.source}</T></dd></div></dl><div className="resource-strip">{detail.resources.map((resource)=><span key={`${resource.kind}-${resource.id}`}>{resource.name}</span>)}</div>{canManage&&<QuickActions detail={detail} clinicId={clinicId} onChanged={onChanged} onError={setError} />}<section className="drawer-section"><h3><T>{"Mută programarea"}</T></h3>{canManage?<RescheduleEditor detail={detail} clinicId={clinicId} timeZone={timeZone} doctors={doctors} incrementMinutes={incrementMinutes} visibleStart={visibleStart} visibleEnd={visibleEnd} onChanged={onChanged} onError={setError} />:<p className="muted"><T>{"Acces numai pentru vizualizare."}</T></p>}</section><section className="drawer-section"><h3><T>{"Note"}</T></h3><textarea className="input textarea" id="appointment-notes" defaultValue={detail.notes} rows={4} readOnly={!canManage}/>{canManage&&<Button variant="outline" size="sm" disabled={pending} onClick={()=>startTransition(async()=>{const notes=(document.getElementById("appointment-notes") as HTMLTextAreaElement).value;const result=await updateAppointmentNotesAction(clinicId,detail.id,notes,detail.updated_at);if(result.ok)onChanged("Notele programării au fost salvate.");else setError(result.error);})}><T>{"Salvează notele"}</T></Button>}</section><section className="drawer-section"><h3><T>{"Istoric"}</T></h3><ol className="appointment-timeline">{detail.history.map((entry,index)=><li key={`${entry.created_at}-${index}`}><span/><div><strong><T>{appointmentEventLabels[entry.event]??entry.event}</T></strong><time>{new Intl.DateTimeFormat(locale,{timeZone,dateStyle:"medium",timeStyle:"short"}).format(new Date(entry.created_at))}</time>{entry.reason&&<small>{entry.reason}</small>}</div></li>)}</ol></section>{error&&<p className="form-error"><T>{error}</T></p>}</div></Panel>;
}

function QuickActions({detail,clinicId,onChanged,onError}:{detail:AppointmentDetail;clinicId:string;onChanged:(m:string)=>void;onError:(m:string)=>void}) {
  const [cancelling,setCancelling]=useState(false);
  const [reason,setReason]=useState("");
  const [pending,startTransition]=useTransition();
  const transitions:Record<string,[string,string][]>={PENDING:[["CONFIRMED","Confirmă"]],CONFIRMED:[["ARRIVED","Marchează sosit"],["NO_SHOW","Neprezentat"]],ARRIVED:[["IN_PROGRESS","Începe"],["NO_SHOW","Neprezentat"]],IN_PROGRESS:[["COMPLETED","Finalizează"]]};
  const canCancel=!["CANCELLED","COMPLETED","NO_SHOW"].includes(detail.status);
  return <>
    <div className="quick-actions">{(transitions[detail.status]??[]).map(([status,label])=><Button key={status} size="sm" disabled={pending||cancelling} variant={status==="NO_SHOW"?"outline":"default"} onClick={()=>startTransition(async()=>{onError("");const result=await appointmentStatusAction(clinicId,detail.id,status,detail.updated_at);if(result.ok)onChanged(`Status actualizat: ${label}.`);else onError(result.error);})}><T>{label}</T></Button>)}{canCancel&&!cancelling&&<Button size="sm" variant="destructive" disabled={pending} onClick={()=>{onError("");setCancelling(true);}}><T>{"Anulează"}</T></Button>}</div>
    {canCancel&&cancelling&&<form className="drawer-section" onSubmit={(event)=>{event.preventDefault();if(pending)return;startTransition(async()=>{onError("");const result=await cancelAppointmentAction(clinicId,detail.id,reason.trim(),detail.updated_at);if(result.ok){setCancelling(false);setReason("");onChanged("Programarea a fost anulată; intervalul este din nou disponibil.");}else onError(result.error);});}}>
      <Field label="Motivul anulării" hint="Opțional, maximum 1.000 de caractere."><textarea className="input textarea" value={reason} onChange={(event)=>setReason(event.target.value)} maxLength={1000} rows={3} disabled={pending}/></Field>
      <div className="quick-actions"><Button type="submit" size="sm" variant="destructive" disabled={pending}><T>{pending?"Se anulează…":"Confirmă anularea"}</T></Button><Button type="button" size="sm" variant="outline" disabled={pending} onClick={()=>{setCancelling(false);setReason("");onError("");}}><T>{"Renunță"}</T></Button></div>
    </form>}
  </>;
}

function RescheduleEditor({detail,clinicId,timeZone,doctors,incrementMinutes,visibleStart,visibleEnd,onChanged,onError}:{detail:AppointmentDetail;clinicId:string;timeZone:string;doctors:Option[];incrementMinutes:number;visibleStart:string;visibleEnd:string;onChanged:(m:string)=>void;onError:(m:string)=>void}) {
  const local=localParts(detail.start_at,timeZone);const [date,setDate]=useState(local.date);const [selectedStart,setSelectedStart]=useState(detail.start_at);const [doctor,setDoctor]=useState(detail.doctor_location_id??"");const [slots,setSlots]=useState<CalendarSlot[]>([]);const [pending,startTransition]=useTransition();
  useEffect(()=>{let active=true;const timer=setTimeout(()=>{startTransition(async()=>{try{const window_start=localToInstant(`${date}T${visibleStart.slice(0,5)}`,timeZone);const window_end=localToInstant(`${date}T${visibleEnd.slice(0,5)}`,timeZone);const response=await calendarRescheduleSlotsAction(clinicId,detail.id,{window_start,window_end,doctor_id:doctor||null,step_minutes:incrementMinutes});if(!active)return;if(response.ok){const available=response.data as CalendarSlot[];setSlots(available);setSelectedStart(current=>available.some((item)=>item.start_at===current)?current:available[0]?.start_at??"");}else onError(response.error);}catch{if(active)onError("Data selectată nu este validă în fusul clinicii.");}});},180);return()=>{active=false;clearTimeout(timer);};},[clinicId,date,detail.id,doctor,incrementMinutes,onError,timeZone,visibleEnd,visibleStart]);
  return <div className="reschedule-form"><div className="inline-fields"><Field label="Data"><DateFieldRo value={date} onChange={(value)=>{setDate(value);setSelectedStart("");}}/></Field><Field label="Medic"><Select value={doctor} onChange={(e)=>{setDoctor(e.target.value);setSelectedStart("");}}><option value=""><T>{"Alocare automată"}</T></option>{doctors.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field></div><div className="compact-slot-select"><span><T>{"Ora disponibilă"}</T></span>{pending?<small><T>{"Se verifică disponibilitatea..."}</T></small>:slots.length?<LocalizedElement as="div" className="slot-picker" aria-label="Ore disponibile">{slots.map((item)=><button type="button" className={selectedStart===item.start_at?"selected":""} key={item.start_at} onClick={()=>setSelectedStart(item.start_at)}>{timeLabel(item.start_at,timeZone)}</button>)}</LocalizedElement>:<small><T>{"Nu există intervale disponibile pentru această zi."}</T></small>}</div><Button variant="outline" size="sm" disabled={pending||!selectedStart} onClick={()=>startTransition(async()=>{const result=await rescheduleAppointmentAction(clinicId,detail.id,{start_at:selectedStart,doctor_id:doctor||null,room_id:null,equipment_ids:[],expected_updated_at:detail.updated_at});if(result.ok)onChanged("Programarea a fost mutată și resursele au fost realocate.");else onError(result.error);})}><T>{"Mută în intervalul selectat"}</T></Button></div>;
}
