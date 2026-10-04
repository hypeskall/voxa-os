import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({send:vi.fn(),close:vi.fn(),create:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("nodemailer",()=>({default:{createTransport:mocks.create}}));
beforeEach(()=>{
  vi.resetModules();vi.clearAllMocks();
  for(const [name,value] of Object.entries({SMTP_HOST:"smtp.example.ro",SMTP_PORT:"587",SMTP_USER:"sender",SMTP_PASSWORD:"secret",SMTP_FROM:"sender@example.ro",SMTP_REPLY_TO:"support@example.ro",ERROR_ALERT_EMAIL:"operator@example.ro"}))vi.stubEnv(name,value);
  mocks.create.mockReturnValue({sendMail:mocks.send,close:mocks.close});
});
afterEach(()=>vi.unstubAllEnvs());
it("reports SMTP acceptance while keeping patient-like diagnostic text out of the alert and throttling duplicates",async()=>{
  const {alertServerError}=await import("../src/lib/email/error-alert");
  mocks.send.mockResolvedValue({accepted:["operator@example.ro"]});
  expect(await alertServerError("acceptance-test","private@example.ro")).toBe(true);
  const sent=mocks.send.mock.calls[0][0];expect(sent.text).not.toContain("private@example.ro");expect(sent.text).toContain("Tip: server");expect(sent.replyTo).toBe("support@example.ro");
  expect(await alertServerError("another-test","route")).toBe(false);expect(mocks.send).toHaveBeenCalledOnce();expect(mocks.close).toHaveBeenCalledOnce();
});
it("returns failure without throwing or leaking SMTP diagnostics and rejects injected references",async()=>{
  const {alertServerError}=await import("../src/lib/email/error-alert");
  expect(await alertServerError("test\r\nBcc:bad@example.ro","route")).toBe(false);expect(mocks.create).not.toHaveBeenCalled();
  mocks.send.mockRejectedValue(new Error("secret private SMTP diagnostics"));
  expect(await alertServerError("valid-test","route")).toBe(false);expect(mocks.close).toHaveBeenCalledOnce();
});
