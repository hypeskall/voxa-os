import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/access", () => ({ requireClinic: vi.fn() }));
import sharp from "sharp";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { validateMedicalFile } from "../src/lib/file-validation";
import { requestFingerprint } from "../src/lib/request-fingerprint";
import { reportToCsv, type ReportData } from "../src/features/reports/data";
import {
  readUploadReceipt,
  signUploadReceipt,
} from "../src/features/documents/upload-receipt";
describe("audit security regressions", () => {
  it("neutralizes spreadsheet formulas including whitespace prefixes while preserving numbers", () => {
    const report: ReportData = {
      from: "2026-10-01",
      to: "2026-10-09",
      summary: {
        total: 1,
        cancelled: 0,
        no_show: 0,
        completed: 1,
        occupancy_percent: -1,
      },
      by_status: [],
      by_source: [],
      by_doctor: [
        { name: "=1+1", count: 1 },
        { name: " \t@SUM(1)", count: 2 },
        { name: 'Quote " test', count: 3 },
      ],
      by_service: [],
      resources: [],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"\' \t@SUM(1)"');
    expect(csv).toContain('"-1"');
    expect(csv).toContain('"Quote "" test"');
  });
  it("keeps the same IP limit when a caller rotates user agents", () => {
    vi.stubEnv("BOOKING_RATE_LIMIT_SALT", "test-rate-salt");
    const request = (ip: string, agent: string) =>
      new Request("https://voxa.test", {
        headers: { "x-forwarded-for": ip, "user-agent": agent },
      });
    expect(requestFingerprint(request("1.2.3.4", "A"))).toBe(
      requestFingerprint(request("1.2.3.4", "B")),
    );
    expect(requestFingerprint(request("1.2.3.5", "A"))).not.toBe(
      requestFingerprint(request("1.2.3.4", "A")),
    );
    vi.unstubAllEnvs();
  });
  it("rejects signature-only fake files and validates decoded content", async () => {
    for (const [mime, bytes] of [
      ["application/pdf", "%PDF-fake"],
      ["image/webp", "RIFF1234WEBPfake"],
    ] as const)
      expect(
        await validateMedicalFile(
          new File([bytes], "bad", { type: mime }),
          [mime],
          1000,
        ),
      ).toBeNull();
    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    expect(
      await validateMedicalFile(
        new File([new Uint8Array(png)], "valid.png", { type: "image/png" }),
        ["image/png"],
        10000,
      ),
    ).toBe("image/png");
  });
  it("rejects PDF automatic actions", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.catalog.set(
      PDFName.of("OpenAction"),
      pdf.context.obj({
        S: PDFName.of("JavaScript"),
        JS: pdf.context.obj("alert(1)"),
      }) as PDFDict,
    );
    const bytes = await pdf.save();
    expect(
      await validateMedicalFile(
        new File([new Uint8Array(bytes)], "active.pdf", {
          type: "application/pdf",
        }),
        ["application/pdf"],
        10000,
      ),
    ).toBeNull();
  });
  it("binds upload receipts to the user, patient, clinic and expiry", () => {
    vi.stubEnv("DOCUMENT_UPLOAD_SECRET", "private-test-signing-secret");
    const cid = "30000000-0000-4000-8000-000000000001",
      pid = "40000000-0000-4000-8000-000000000001",
      uid = "10000000-0000-4000-8000-000000000001";
    const metadata = {
      cid,
      pid,
      uid,
      path: `${cid}/${pid}/documents/test`,
      expires: Date.now() + 10000,
      title: "Test",
      document_type_id: "60000000-0000-4000-8000-000000000001",
      appointment_id: null,
      visible_to_patient: false,
      file_name: "test.pdf",
      mime: "application/pdf" as const,
      bytes: 100,
      result: false,
    };
    const token = signUploadReceipt(metadata);
    expect(readUploadReceipt(token, cid, pid, uid).path).toBe(metadata.path);
    expect(() => readUploadReceipt(token, cid, pid, pid)).toThrow();
    expect(() =>
      readUploadReceipt(token.replace(/^./, "A"), cid, pid, uid),
    ).toThrow();
    expect(() =>
      readUploadReceipt(
        signUploadReceipt({ ...metadata, expires: Date.now() - 1 }),
        cid,
        pid,
        uid,
      ),
    ).toThrow();
    vi.unstubAllEnvs();
  });
});
