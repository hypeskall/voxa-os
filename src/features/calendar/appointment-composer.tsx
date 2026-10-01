"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarPlus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { DateFieldRo } from "@/components/ui/date-field-ro";
import type { Option } from "@/features/core-clinic/model";
import { localToInstant } from "@/features/core-clinic/validation";
import {
  calendarSlotsAction,
  createAppointmentAction,
  createPatientInlineAction,
} from "./actions";

type Patient = { id: string; name: string; phone?: string; email?: string; internal_id?: string };
type DoctorOption = Option & { service_ids?: string[] };
type Slot = { start_at: string; end_at: string; assignment: { doctor_id: string | null; room_id: string | null; equipment: { id: string }[] } };
type CreateResult = {
  ok: boolean;
  appointment_id?: string;
  assignment?: Slot["assignment"];
  warnings?: { code: string; appointment_id?: string; start_at?: string }[];
  requires_override?: boolean;
};

export function AppointmentComposer({
  clinicId,
  timeZone,
  services,
  doctors,
  rooms,
  equipment,
  initialDate,
  incrementMinutes,
  visibleStart,
  visibleEnd,
  canOverride,
  onCreated,
  onOpenAppointment,
  prefill,
}: {
  clinicId: string;
  timeZone: string;
  services: Option[];
  doctors: DoctorOption[];
  rooms: Option[];
  equipment: Option[];
  initialDate: string;
  incrementMinutes: number;
  visibleStart: string;
  visibleEnd: string;
  canOverride: boolean;
  onCreated: (message: string) => void;
  onOpenAppointment: (id: string) => void;
  prefill?: { key: number; date: string; time: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [newPatient, setNewPatient] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [customizeResources, setCustomizeResources] = useState(false);
  const [manualRoomId, setManualRoomId] = useState("");
  const [manualEquipmentIds, setManualEquipmentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<CreateResult | null>(null);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const slotRequest = useRef(0);
  const preferredTime = useRef("");
  const [isPending, startTransition] = useTransition();
  const roomNames = useMemo(() => new Map(rooms.map((item) => [item.id, item.name])), [rooms]);
  const equipmentNames = useMemo(() => new Map(equipment.map((item) => [item.id, item.name])), [equipment]);
  const eligibleDoctors = useMemo(() => serviceId ? doctors.filter((doctor) => doctor.service_ids?.includes(serviceId)) : doctors, [doctors, serviceId]);

  useEffect(() => {
    if (!open || patient || patientQuery.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/clinics/${clinicId}/data/patients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: patientQuery, state: "active", sort_key: "name", descending: false, page_number: 1, filter_id: null }),
          signal: controller.signal,
        });
        if (response.ok) setPatients((await response.json()).items as Patient[]);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [clinicId, open, patient, patientQuery]);

  useEffect(() => {
    if (!prefill) return;
    preferredTime.current = prefill.time;
    queueMicrotask(() => { setDate(prefill.date); setOpen(true); });
  }, [prefill]);

  function reset() {
    setDate(initialDate); preferredTime.current = ""; slotRequest.current++;
    setPatientQuery(""); setPatients([]); setPatient(null); setNewPatient(false);
    setServiceId(""); setDoctorId(""); setSlots([]); setSlot(null); setSlotsLoaded(false); setCustomizeResources(false); setManualRoomId(""); setManualEquipmentIds([]); setNotes(""); setError(""); setDuplicate(null);
  }
  function close() { setOpen(false); reset(); }

  function loadSlots() {
    const request = ++slotRequest.current;
    setError(""); setSlot(null); setSlots([]); setSlotsLoaded(false); setCustomizeResources(false); setManualRoomId(""); setManualEquipmentIds([]);
    if (!serviceId || !date) return setError("Selectați serviciul și data.");
    let windowStart: string, windowEnd: string;
    try {
      windowStart = localToInstant(`${date}T${visibleStart.slice(0, 5)}`, timeZone);
      windowEnd = localToInstant(`${date}T${visibleEnd.slice(0, 5)}`, timeZone);
    } catch { return setError("Data selectată nu este validă în fusul clinicii."); }
    startTransition(async () => {
      const response = await calendarSlotsAction(clinicId, {
        service_id: serviceId, doctor_id: doctorId || null, window_start: windowStart, window_end: windowEnd, step_minutes: incrementMinutes,
      });
      if (request !== slotRequest.current) return;
      setSlotsLoaded(true);
      if (!response.ok) setError(response.error);
      else {
        const available = response.data as Slot[];
        setSlots(available);
        if (preferredTime.current) {
          const preferred = available.find((item) => new Intl.DateTimeFormat("sv-SE", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(item.start_at)) === preferredTime.current);
          if (preferred) setSlot(preferred);
          preferredTime.current = "";
        }
      }
    });
  }

  useEffect(() => {
    if (!open || !serviceId || !date) return;
    const timer = setTimeout(() => loadSlots(), 180);
    return () => { clearTimeout(timer); slotRequest.current += 1; };
    // loadSlots reads the current selection; the request sequence prevents stale results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceId, doctorId, date, incrementMinutes, visibleStart, visibleEnd]);

  async function submit(override = false) {
    if (!patient || !serviceId || !slot) return setError("Selectați pacientul, serviciul și intervalul.");
    setError("");
    const response = await createAppointmentAction(clinicId, {
      patient_id: patient.id,
      service_id: serviceId,
      doctor_id: doctorId || slot.assignment.doctor_id,
      room_id: customizeResources ? manualRoomId || null : slot.assignment.room_id,
      equipment_ids: customizeResources ? manualEquipmentIds : slot.assignment.equipment.map((item) => item.id),
      start_at: slot.start_at,
      source: "RECEPTION",
      status: "PENDING",
      notes,
      override_duplicate: override,
      override_reason: override ? "Confirmată de recepție după verificare" : "",
    });
    if (!response.ok) return setError(response.error);
    const result = response.data as CreateResult;
    if (!result.ok && result.requires_override) return setDuplicate(result);
    if (!result.ok) return setError("Intervalul nu mai este disponibil. Selectați un alt interval.");
    const assignedRoom = result.assignment?.room_id ? roomNames.get(result.assignment.room_id) : null;
    const assignedEquipment = result.assignment?.equipment.map((item) => equipmentNames.get(item.id)).filter(Boolean).join(", ");
    close();
    onCreated(`Programarea a fost creată${assignedRoom ? ` în ${assignedRoom}` : ""}${assignedEquipment ? ` · ${assignedEquipment}` : ""}.`);
  }

  return (
    <Panel
      open={open}
      onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}
      title="Programare nouă"
      description="Selectați pacientul și serviciul; resursele sunt alocate automat."
      drawer
      trigger={<Button onClick={() => setOpen(true)}><CalendarPlus size={16} />Programare nouă</Button>}
    >
      <div className="appointment-form">
        <section className="form-section">
          <div className="form-section-title"><span>1</span><h3>Pacient</h3></div>
          {patient ? (
            <div className="selected-record"><div><strong>{patient.name}</strong><small>{patient.phone || patient.email || patient.internal_id}</small></div><Button variant="ghost" size="sm" onClick={() => setPatient(null)}>Schimbă</Button></div>
          ) : newPatient ? (
            <InlinePatient clinicId={clinicId} onCancel={() => setNewPatient(false)} onCreated={(created) => { setPatient(created); setNewPatient(false); }} />
          ) : (
            <>
              <div className="patient-search-combobox"><label className="search-field"><Search size={16} /><Input role="combobox" aria-expanded={patientQuery.trim().length >= 2 && patients.length > 0} aria-controls="patient-search-results" aria-label="Caută pacient" placeholder="Nume, telefon, email sau identificator" value={patientQuery} onChange={(event) => { setPatientQuery(event.target.value); setPatients([]); }} /></label>
              {patientQuery.trim().length >= 2 && <div className="search-results" id="patient-search-results" role="listbox">
                {patients.map((item) => <button type="button" key={item.id} onClick={() => setPatient(item)}><strong>{item.name}</strong><span>{[item.phone,item.email,item.internal_id].filter(Boolean).join(" · ")}</span></button>)}
                {!patients.length&&<span className="search-pending">Se caută...</span>}
              </div>}</div>
              <Button variant="outline" size="sm" onClick={() => setNewPatient(true)}><Plus size={15} />Pacient nou</Button>
            </>
          )}
        </section>
        <section className="form-section">
          <div className="form-section-title"><span>2</span><h3>Serviciu și medic</h3></div>
          <Field label="Serviciu"><Select aria-label="Serviciu" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setDoctorId(""); setSlots([]); setSlot(null); setSlotsLoaded(false); }}><option value="">Selectați</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Medic"><Select aria-label="Medic" value={doctorId} onChange={(event) => { setDoctorId(event.target.value); setSlots([]); setSlot(null); setSlotsLoaded(false); }}><option value="">Alocare automată</option>{eligibleDoctors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>{serviceId && !eligibleDoctors.length && <small className="muted">Serviciul nu are încă medici eligibili configurați.</small>}</Field>
        </section>
        <section className="form-section">
          <div className="form-section-title"><span>3</span><h3>Dată și interval</h3></div>
          <Field label="Data"><DateFieldRo value={date} onChange={(value) => { setDate(value); setSlots([]); setSlot(null); setSlotsLoaded(false); }} /></Field>
          {isPending ? <div className="slot-skeleton" aria-label="Se verifică disponibilitatea"><span className="slot-loading-copy">Se verifică disponibilitatea...</span>{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div> : slots.length > 0 ? <div className="slot-picker" aria-label="Intervale disponibile">{slots.map((item) => { const formatter = new Intl.DateTimeFormat("ro-RO", { timeZone, hour: "2-digit", minute: "2-digit" }); return <button type="button" className={slot?.start_at === item.start_at ? "selected" : ""} key={item.start_at} title={`${formatter.format(new Date(item.start_at))} – ${formatter.format(new Date(item.end_at))}`} onClick={() => { setSlot(item); setCustomizeResources(false); setManualRoomId(""); setManualEquipmentIds([]); }}>{formatter.format(new Date(item.start_at))}</button>; })}</div> : slotsLoaded && serviceId ? <div className="compact-empty"><strong>Nu există intervale disponibile pentru această zi.</strong><span>{doctorId ? "Medicul selectat nu este disponibil. Încercați alocarea automată." : "Alegeți o altă dată sau verificați programul resurselor."}</span>{doctorId&&<Button variant="outline" size="sm" onClick={()=>setDoctorId("")}>Încearcă alocare automată</Button>}</div> : !serviceId ? <p className="muted compact-copy">Selectează un serviciu pentru a vedea intervalele disponibile.</p> : null}
        </section>
        {slot && <section className="allocation-summary"><strong>Alocare propusă</strong><span>{slot.assignment.doctor_id ? doctors.find((item) => item.id === slot.assignment.doctor_id)?.name : "Fără medic"}</span><span>{slot.assignment.room_id ? roomNames.get(slot.assignment.room_id) : "Fără cabinet"}</span>{slot.assignment.equipment.map((item) => <span key={item.id}>{equipmentNames.get(item.id) ?? "Echipament alocat"}</span>)}<Button variant="ghost" size="sm" onClick={() => setCustomizeResources((value) => !value)}>{customizeResources ? "Păstrează alocarea propusă" : "Schimbă resursele"}</Button>{customizeResources && <div className="resource-customizer"><Field label="Cabinet"><Select value={manualRoomId} onChange={(event) => setManualRoomId(event.target.value)}><option value="">Alocare automată</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><fieldset><legend>Echipamente</legend><label><input type="checkbox" checked={manualEquipmentIds.length === 0} onChange={() => setManualEquipmentIds([])} /> Alocare automată</label>{equipment.map((item) => <label key={item.id}><input type="checkbox" checked={manualEquipmentIds.includes(item.id)} onChange={(event) => setManualEquipmentIds((values) => event.target.checked ? [...values, item.id] : values.filter((id) => id !== item.id))} /> {item.name}</label>)}</fieldset><small>Motorul verifică eligibilitatea și disponibilitatea selecției înainte de salvare.</small></div>}</section>}
        <Field label="Note"><textarea className="input textarea" rows={3} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        {duplicate && <div className="warning-box"><strong>Posibilă programare duplicată</strong><p>Există deja o programare apropiată pentru același pacient și serviciu.</p><div className="dialog-actions">{duplicate.warnings?.[0]?.appointment_id && <Button variant="outline" onClick={() => onOpenAppointment(duplicate.warnings![0].appointment_id!)}>Vezi programarea</Button>}<Button variant="ghost" onClick={() => setDuplicate(null)}>Renunță</Button>{canOverride && <Button onClick={() => submit(true)}>Continuă oricum</Button>}</div></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!duplicate && <div className="dialog-actions"><Button variant="ghost" onClick={close}>Renunță</Button><Button disabled={isPending || !patient || !slot} onClick={() => startTransition(() => submit())}>Creează programarea</Button></div>}
      </div>
    </Panel>
  );
}

function InlinePatient({ clinicId, onCancel, onCreated }: { clinicId: string; onCancel: () => void; onCreated: (patient: Patient) => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  return <div className="inline-patient"><Field label="Nume și prenume"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field><div className="inline-fields"><Field label="Telefon"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field><Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><Button variant="ghost" size="sm" onClick={onCancel}>Înapoi</Button><Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const response = await createPatientInlineAction(clinicId, { name, phone, email }); if (!response.ok) setError(response.error); else onCreated(response.data as Patient); })}>Salvează pacientul</Button></div></div>;
}
