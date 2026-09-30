import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PDFDocument } from "pdf-lib";
import { resultPdf } from "../src/features/results/pdf";
import type { ResultDetail } from "../src/features/results/model";

describe("medical PDF", () => {
  it("creates a printable A4 document with Romanian diacritics and identifiers", async () => {
    const result: ResultDetail = {
      id:"90000000-0000-4000-8000-000000000001", organization_id:"20000000-0000-4000-8000-000000000001", clinic_id:"30000000-0000-4000-8000-000000000001", patient_id:"40000000-0000-4000-8000-000000000001", appointment_id:"50000000-0000-4000-8000-000000000001", service_id:"60000000-0000-4000-8000-000000000001", doctor_location_id:"70000000-0000-4000-8000-000000000001", title:"Rezultat consultație", content:"Conținut medical cu diacritice: ă â î ș ț.\nConcluzie clinică.", status:"VALIDATED", version:2, pdf_object_path:null, created_by:"10000000-0000-4000-8000-000000000004", validated_by:"10000000-0000-4000-8000-000000000004", released_by:null, validated_at:"2026-09-29T10:00:00Z", released_at:null, created_at:"2026-09-29T09:00:00Z", updated_at:"2026-09-29T10:00:00Z", patient_name:"Pacient Test", patient_internal_id:"PX-001", birth_date:"1980-01-01", service_name:"Consultație", doctor_name:"Dr. Test", professional_code:"PARAFA-1", clinic_name:"Clinica Test", clinic_address:"Strada Test 1", clinic_phone:"+40 000 000", timezone:"Europe/Bucharest",
    };
    const bytes = await resultPdf(result);
    expect(Buffer.from(bytes).subarray(0,4).toString()).toBe("%PDF");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const { width, height } = loaded.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 1); expect(height).toBeCloseTo(841.89, 1);
  });
});
