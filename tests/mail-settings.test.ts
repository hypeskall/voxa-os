import { describe, expect, it } from "vitest";
// @ts-expect-error Operator-only Node module has no declarations.
import { approvedMailSettings, mailSettings, mailTransportOptions } from "../scripts/mail-settings.mjs";

const ref = "fibcbsdattoqiyizzeda";
const env = { MAIL_PROVIDER:"brevo", SMTP_HOST:"smtp-relay.brevo.com", SMTP_PORT:"587",
  SMTP_USER:"synthetic@smtp-brevo.com", SMTP_PASSWORD:"synthetic-test-key-123456", SMTP_FROM:"noreply@notify.voxatech.ro", SMTP_REPLY_TO:"contact@voxatech.ro",
  AUTH_EMAIL_HOURLY_LIMIT:"10", MAIL_DOMAIN_VERIFIED:"true", MAIL_CONFIGURATION_APPROVED:"true", MAIL_APPROVED_PROJECT_REF:ref };

describe("reviewed transactional email configuration", () => {
  it("rejects mailbox, injected hosts, placeholder keys, wrong sender and unreviewed quotas", () => {
    for (const patch of [{MAIL_PROVIDER:"zoho"},{SMTP_HOST:"smtp.zoho.eu"},{SMTP_HOST:"smtp-relay.brevo.com.evil.invalid"},
      {SMTP_USER:"user\r\n@evil.invalid"},{SMTP_PASSWORD:"replace-with-private-key"},{SMTP_PASSWORD:"secret\nkey-that-is-long"},
      {SMTP_FROM:"other@voxatech.ro"},{AUTH_EMAIL_HOURLY_LIMIT:"0"},{AUTH_EMAIL_HOURLY_LIMIT:"11"},{AUTH_EMAIL_HOURLY_LIMIT:"2.5"}])
      expect(() => mailSettings({...env,...patch})).toThrow();
  });
  it("refuses mutations for unverified domains, absent approval and a different project", () => {
    for (const patch of [{MAIL_DOMAIN_VERIFIED:"false"},{MAIL_CONFIGURATION_APPROVED:"false"},{MAIL_APPROVED_PROJECT_REF:"wlnrfjrjkyywqyvsngps"}])
      expect(() => approvedMailSettings({...env,...patch},ref)).toThrow();
    expect(approvedMailSettings(env,ref)).toMatchObject({host:env.SMTP_HOST,hourlyLimit:10});
  });
  it("requires certificate verification and disables content/file/debug access on both TLS ports", () => {
    for (const port of ["465","587"]) {
      expect(mailTransportOptions(mailSettings({...env,SMTP_PORT:port}))).toMatchObject({port:Number(port),secure:port==="465",
        requireTLS:true,tls:{minVersion:"TLSv1.2",rejectUnauthorized:true},logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
    }
  });
});
