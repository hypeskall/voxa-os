import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { callerQuery, migratedDatabase, ids } from "./support/database";
import {
  defaultWhatsappReminderTemplate,
  renderReminderTemplate,
  whatsappUrl,
} from "../src/lib/phone";

describe("manual WhatsApp reminder", () => {
  it("lists only tomorrow's active appointments in the clinic timezone and checks access", async () => {
    const db = await migratedDatabase();
    try {
      await db.query("update public.clinics set timezone='Europe/Bucharest' where id=$1", [ids.a]);
      const patient = (await db.query<{ id: string }>("insert into public.patients(organization_id,clinic_id,name,internal_id,phone) values($1,$2,'Reminder Patient','WA-1','0700000001') returning id", [ids.org, ids.a])).rows[0].id;
      const service = (await db.query<{ id: string }>("insert into public.services(organization_id,clinic_id,name,duration_minutes) values($1,$2,'Reminder consultation',30) returning id", [ids.org, ids.a])).rows[0].id;
      const expected: string[] = [];
      for (const [start, status] of [
        ['2026-10-05T20:00:00Z', 'PENDING'],
        ['2026-10-05T21:00:00Z', 'PENDING'],
        ['2026-10-06T08:00:00Z', 'CONFIRMED'],
        ['2026-10-06T10:00:00Z', 'CANCELLED'],
        ['2026-10-06T11:00:00Z', 'COMPLETED'],
        ['2026-10-06T12:00:00Z', 'NO_SHOW'],
        ['2026-10-06T21:00:00Z', 'PENDING'],
      ]) {
        const result = await db.query<{ id: string }>(`insert into public.appointments(organization_id,clinic_id,patient_id,service_id,start_at,end_at,occupied_start_at,occupied_end_at,duration_minutes,buffer_before,buffer_after,status,cancelled_at)
          values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz+interval '30 minutes',$5::timestamptz,$5::timestamptz+interval '30 minutes',30,0,0,$6::public.appointment_status,case when $6='CANCELLED' then now() else null end) returning id`, [ids.org, ids.a, patient, service, start, status]);
        if (start === '2026-10-05T21:00:00Z' || start === '2026-10-06T08:00:00Z') expected.push(result.rows[0].id);
      }
      const result = await callerQuery<{ reminders: { id: string }[] }>(db, ids.reception,
        "select public.tomorrow_whatsapp_reminders($1,$2) reminders", [ids.a, '2026-10-05']);
      expect(result.rows[0].reminders.map(item => item.id)).toEqual(expected);
      await expect(callerQuery(db, ids.outsider, "select public.tomorrow_whatsapp_reminders($1,$2)", [ids.a, '2026-10-05'])).rejects.toThrow(/Access denied/);
    } finally { await db.close(); }
  });
  it("uses the actual appointment date and details without assuming tomorrow", () => {
    const message = renderReminderTemplate(defaultWhatsappReminderTemplate, {
      patient_first_name: "Ion", patient_name: "Ion Popescu",
      date: "05.10.2026", time: "11:00", service_name: "Consultație",
      doctor_name: "Ana Popescu", clinic_name: "Clinica Test Voxa Oradea",
      clinic_address: "Strada Testului 1", clinic_phone: "+40700000001",
    });
    expect(message).not.toContain("mâine");
    for (const value of ["Ion Popescu", "05.10.2026", "11:00", "Consultație", "Ana Popescu", "Clinica Test Voxa Oradea"])
      expect(message).toContain(value);
    const local = whatsappUrl("0700000001", message);
    expect(local).toBe(whatsappUrl("+40700000001", message));
    const url = new URL(local!);
    expect(url.pathname).toBe("/40700000001");
    expect(url.searchParams.get("text")).toBe(message);
  });

  it("migrates the old default while keeping customized clinic messages", async () => {
    const db = await migratedDatabase();
    try {
      const old = "Bună ziua, {{patient_first_name}}. Vă reamintim că mâine, {{date}}, la ora {{time}}, aveți o programare la {{clinic_name}}, {{clinic_address}}. Dacă nu mai puteți ajunge, vă rugăm să ne anunțați. Vă mulțumim.";
      const custom = "Mesaj personalizat pentru programarea din {{date}}.";
      await db.query("update public.clinics set whatsapp_reminder_template=$1 where id=$2", [old, ids.a]);
      await db.query("update public.clinics set whatsapp_reminder_template=$1 where id=$2", [custom, ids.b]);
      await db.exec(fs.readFileSync("supabase/migrations/202610030029_whatsapp_reminder_date.sql", "utf8"));
      const result = await db.query<{ id: string; whatsapp_reminder_template: string }>("select id,whatsapp_reminder_template from public.clinics where id in ($1,$2)", [ids.a,ids.b]);
      expect(result.rows.find(row=>row.id===ids.a)?.whatsapp_reminder_template).toBe(defaultWhatsappReminderTemplate);
      expect(result.rows.find(row=>row.id===ids.b)?.whatsapp_reminder_template).toBe(custom);
    } finally { await db.close(); }
  });
});
