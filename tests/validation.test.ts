import { describe, it, expect } from "vitest";
import { can } from "../src/lib/permissions";
import {
  clinicSchema,
  loginSchema,
  preferencesSchema,
} from "../src/lib/validation";
describe("Server validation and permission gates", () => {
  it("denies unknown and missing permissions", () => {
    expect(can([], "members.manage")).toBe(false);
    expect(can(["clinic.read"], "audit.read")).toBe(false);
    expect(can(["audit.read"], "audit.read")).toBe(true);
  });
  it("rejects invalid values", () => {
    expect(
      clinicSchema.safeParse({ name: " ", address: "", timezone: "Invalid" })
        .success,
    ).toBe(false);
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(
      false,
    );
    expect(
      preferencesSchema.safeParse({ density: "wide", default_clinic_id: "x" })
        .success,
    ).toBe(false);
  });
  it("normalizes optional clinic and trims names", () => {
    expect(
      preferencesSchema.parse({ density: "compact", default_clinic_id: "" })
        .default_clinic_id,
    ).toBeNull();
    expect(
      clinicSchema.parse({
        name: "  Clinic  ",
        address: "",
        timezone: "Europe/Bucharest",
        whatsapp_reminder_template: "Bună ziua, vă reamintim programarea de mâine.",
      }).name,
    ).toBe("Clinic");
  });
});
