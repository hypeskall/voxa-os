import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { migratedDatabase, ids } from "./support/database";
import {
  defaultWhatsappReminderTemplate,
  renderReminderTemplate,
  whatsappUrl,
} from "../src/lib/phone";

describe("manual WhatsApp reminder", () => {
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
