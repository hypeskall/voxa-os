# Transactional email handoff — 4 October 2026

Production confirmation and password recovery were received and completed in a controlled test. [Zoho Mail's current usage policy](https://www.zoho.com/mail/help/usage-policy.html) excludes automated/transactional sending, so production automated delivery was migrated to Brevo with explicit authorization. The ordinary Zoho support mailbox remains in use.

The owner created a Brevo account. [Brevo Free includes transactional email and 300 daily email sends](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans). The owner published the DNS records; all four records were resolved publicly, Brevo reports the subdomain authenticated, and the Voxa sender is verified with its own DKIM domain and configured DMARC. A dedicated owner-generated SMTP key passed certificate-verified TLS authentication. After explicit authorization, production Supabase Auth settings were applied/read back and Vercel's private SMTP variables were saved. The deployment is ready, and one normal Auth recovery email arrived in the controlled owner's Inbox. No patient contact database is imported, no marketing campaign is created, and patient automated delivery remains disabled.

## Provider and DNS

1. Use the sending subdomain `notify.voxatech.ro` in Brevo's Senders, Domains & Dedicated IPs → Domains. The root domain already serves the owner's main site and Zoho mailbox. The new subdomain needs no separate purchase. Use individual DNS records with manual configuration; branded tracking and DNS delegation are not enabled. Do not guess a DKIM selector or alter existing Zoho MX records.
2. Publish the provided domain verification and DKIM records in the authoritative DNS provider after owner approval. Preserve the existing single DMARC record until its alignment and reporting destination are reviewed; do not add a second DMARC/SPF record or strengthen enforcement blindly.
3. Verify that Brevo reports the domain authenticated; separately resolve the actual DNS records. Configure the sender `Voxa-OS <noreply@notify.voxatech.ro>` and confirm its verified status. Route application email replies to `contact@voxatech.ro`; public support and operator alert recipients keep that monitored mailbox.
4. Generate a dedicated SMTP key only after approval of this new access. [Brevo requires the SMTP key, not an API key](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP). Enter it directly into ignored `.env.mail.local`, copied from `.env.mail.example`; never paste credentials in chat or publish them. No general API key is required by Voxa.

## Exact-target configuration

The owner must approve saving the dedicated Brevo SMTP credential to production Supabase Auth and the private Vercel `voxa-os` SMTP variables. Brevo will receive transactional recipient addresses and confirmation/recovery/invitation message content when users request those operations. This changes the email processor and must be reflected in the launch processor/legal review.

After actual sender verification and exact-target approval, set `MAIL_DOMAIN_VERIFIED=true`, `MAIL_CONFIGURATION_APPROVED=true` and `MAIL_APPROVED_PROJECT_REF` locally. The default pilot Auth quota is 10/hour (up to 240/day); staff invitations/operator mail also consume the shared provider allowance. Provider daily queuing/account restrictions may still affect timely delivery; monitor usage, keep this account dedicated to Voxa and review capacity before growth.

- `node scripts/launch-config.mjs smtp-check` verifies credentials over certificate-verified TLS without sending a message. It does not prove sender/inbox acceptance.
- `node scripts/launch-config.mjs auth` applies and reads back the named production Auth configuration and reviewed hourly quota.
- `node scripts/launch-config.mjs vercel` applies private production SMTP variables, retaining `NOTIFICATION_DELIVERY_ENABLED=false`. Redeploy production to load those variables and verify deployment readiness.
- The optional `staging` argument uses the named staging target. Never implicitly approve or reuse production credentials for staging. Staging app configuration remains manual invitations/development notifications without SMTP secrets.

Before calling the migration complete, send a single owner-approved controlled recovery request and confirm its actual receipt, sender authentication and normal login. Observe provider acknowledgement/logs without publishing message contents or token-bearing links. Check operator alert delivery and staff invitation behavior separately using synthetic recipients/accounts. Do not repeatedly retry accepted/uncertain invitations; the durable acknowledgement ledger intentionally blocks duplicate delivery.

The configurator now refuses ordinary Zoho Mail as an automated sending destination and does not silently fall back to the old mailbox credential. This is an operator-tool change; it does not mutate current production configuration on import or deploy.

## Current account handoff

Brevo generated the records for the unused sending subdomain. Public DNS nameservers for `voxatech.ro` are Vercel's. The connected Voxa Vercel team has no domain entry and its API returns forbidden for this domain; the owner published the subdomain records privately from the correct account. No website/root/MX DNS mutations were performed by this task.

The records shown by this account are one verification TXT at `notify`, two DKIM CNAMEs at `brevo1._domainkey.notify` and `brevo2._domainkey.notify`, and a DMARC TXT at `_dmarc.notify`. The owner-published DMARC is monitoring-only and routes aggregate reports to Brevo. Record values and credential material are not added to this public handoff report; obtain the actual values from the provider.

Validation for the implementation: 206 tests in 28 files, lint, typecheck and optimized build pass. The new reply-to field is validated before SMTP transmission, including rejection of injected email headers. The key and local settings are excluded from Git and Vercel source uploads; only the explicitly approved SMTP variables were saved in Vercel's private environment.

Published revision: `451b0aab01d3aedb786c2bc3ca124f47f5f38ba1`; Vercel deployment `dpl_8gBQ62TJjJQb4JDYBiXMq8AK79qD` is `READY`. Auth readback confirms `smtp-relay.brevo.com`, the new sender, 10/hour pilot quota, mandatory confirmation and enabled signup. All six live public readiness checks pass after deployment. Controlled inbox receipt is owner-reported; message header authentication and provider alert/invitation delivery are separate checks and are not claimed proven merely by the domain's DNS status.
