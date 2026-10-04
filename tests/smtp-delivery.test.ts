import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks=vi.hoisted(()=>({send:vi.fn(),close:vi.fn(),create:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("nodemailer",()=>({default:{createTransport:mocks.create}}));
vi.mock("@/lib/supabase/admin",()=>({adminDb:()=>({rpc:mocks.rpc})}));
import { sendTransactionalEmail } from "../src/lib/email/smtp";
import { notificationProvider } from "../src/features/notifications/provider";
beforeEach(()=>{
  vi.clearAllMocks();
  for(const [name,value] of Object.entries({SMTP_HOST:"smtp.example.ro",SMTP_PORT:"587",SMTP_USER:"sender",SMTP_PASSWORD:"private-password",SMTP_FROM:"sender@example.ro"}))vi.stubEnv(name,value);
  mocks.create.mockReturnValue({sendMail:mocks.send,close:mocks.close});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
const message={to:"staff@example.ro",subject:"Invitație",text:"Conținut privat",key:"invite-unique"};
describe("SMTP delivery security and uncertainty",()=>{
  it("requires verified TLS, closes the connection, and records confirmed acceptance",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:"claimed",error:null}).mockResolvedValueOnce({error:null});
    mocks.send.mockResolvedValue({accepted:[message.to]});
    await expect(sendTransactionalEmail(message)).resolves.toHaveProperty("messageId");
    expect(mocks.create.mock.calls[0][0]).toMatchObject({requireTLS:true,tls:{minVersion:"TLSv1.2",rejectUnauthorized:true},logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
    expect(mocks.rpc.mock.calls[1]).toEqual(["finish_transactional_email",expect.objectContaining({outcome:"accepted"})]);
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("never sends again for accepted, in-progress or uncertain reservations",async()=>{
    mocks.rpc.mockResolvedValue({data:"accepted",error:null});
    await sendTransactionalEmail(message);expect(mocks.send).not.toHaveBeenCalled();
    for(const status of ["sending","uncertain"]){mocks.rpc.mockResolvedValue({data:status,error:null});await expect(sendTransactionalEmail(message)).rejects.toThrow(/verificată/);}
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("records timeout uncertainty and never leaks raw SMTP credentials or content",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:"claimed",error:null}).mockResolvedValueOnce({error:null});
    mocks.send.mockRejectedValue(new Error("private-password staff@example.ro Conținut privat"));
    await expect(sendTransactionalEmail(message)).rejects.toThrow("Trimiterea emailului nu a fost confirmată. Verificați serviciul înainte de retrimitere.");
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({outcome:"uncertain"});
  });
  it("rejects header injection before contacting SMTP and refuses synthetic production delivery",async()=>{
    await expect(sendTransactionalEmail({...message,subject:"Hello\r\nBcc: evil@example.ro"})).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
    vi.stubEnv("APP_ENVIRONMENT","production");vi.stubEnv("NOTIFICATION_PROVIDER","development");
    expect(()=>notificationProvider()).toThrow(/producție/);
    vi.stubEnv("NOTIFICATION_PROVIDER","smtp");
    await expect(notificationProvider().send({channel:"SMS",recipient:"0700000000",subject:"",body:"",idempotencyKey:"test"})).rejects.toThrow(/SMS/);
  });
  it("routes replies to the support mailbox and rejects injected reply addresses before sending",async()=>{
    vi.stubEnv("SMTP_REPLY_TO","contact@example.ro");
    mocks.rpc.mockResolvedValueOnce({data:"claimed",error:null}).mockResolvedValueOnce({error:null});
    mocks.send.mockResolvedValue({accepted:[message.to]});
    await sendTransactionalEmail(message);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({replyTo:"contact@example.ro"});
    vi.clearAllMocks();
    vi.stubEnv("SMTP_REPLY_TO","contact@example.ro\r\nBcc:evil@example.ro");
    await expect(sendTransactionalEmail(message)).rejects.toThrow();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
