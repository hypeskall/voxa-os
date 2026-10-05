import { describe, expect, test } from "vitest";
import { authEmailConfiguration } from "../scripts/auth-email-templates.mjs";

describe("production and staging Auth emails", () => {
  test("production has Romanian subjects, branding and safe original token destinations", () => {
    const config = authEmailConfiguration();
    expect(Object.keys(config)).toHaveLength(8);
    expect(config.mailer_subjects_invite).toContain("Invitație");
    expect(config.mailer_subjects_magic_link).toContain("conectare");
    for (const value of Object.values(config)) {
      expect(value).not.toMatch(/staging|You've been invited|Your sign-in link|\/invitations\//i);
    }
    expect(config.mailer_templates_invite_content).toContain('type=invite');
    expect(config.mailer_templates_magic_link_content).toContain('type=magiclink');
    expect(config.mailer_templates_confirmation_content).toContain('type=signup');
    expect(config.mailer_templates_recovery_content).toContain('/auth/recovery?token_hash={{ .TokenHash }}');
    expect(config.mailer_templates_invite_content).toContain('lang="ro"');
    expect(config.mailer_templates_invite_content).toContain('contact@voxatech.ro');
  });
  test("staging stays explicitly separate", () => {
    const config = authEmailConfiguration(true);
    expect(config.mailer_subjects_invite).toContain("Test");
    expect(config.mailer_templates_invite_content).toContain("staging");
  });
});
