# Session locks, private scanning and backup recovery

Owner selected these three controls on 12 October 2026. This document separates
implementation from hosted activation; prepared code alone is not deployment.

## Session controls

Migration 051 ties activity to the real Supabase `session_id` and `auth.sessions`
owner, checks provider revocation/expiry, and enforces ten minutes of inactivity
and an eight-hour absolute lifetime. A server-owned row tracks timestamps;
browser clocks and JWT refresh cannot extend the absolute lifetime. Expired
activity cannot be revived through a heartbeat. Normal checks/prefetching do not
extend inactivity; only explicit foreground interaction sends an activity POST.

The UI warns sixty seconds before the deadline and removes the clinical page
when it expires. Protected pages, actions and APIs enforce the gate themselves;
the existing SQL MFA/RLS helper also checks activity, so UI bypass is insufficient.
Session status is an intentional bootstrap RPC available before MFA completion;
it returns only the caller's own deadlines and does not grant clinical access.

Patient/report exports and MFA policy changes require a sign-in within five minutes at
the SQL entry point. MFA enrollment/removal and session revocation also require
recent authentication in server actions. The confirmation page verifies the
current user's password, creates a fresh provider session, and completes MFA
when enrolled. Redirect destinations are restricted to known local routes.
Existing issued tokens lose database access as soon as their Auth session is
removed; clinical activity has no grace period beyond the configured limits.

## Private scanner and quarantine

The scanner in `services/medical-scanner` uses real ClamAV on a private EU host.
It receives the file bytes transiently over authenticated HTTPS, without patient
keys, database credentials, names or original filenames. Definitions older than
48 hours and unknown/error/limit verdicts fail closed. The response's HMAC binds
the exact content SHA-256, random request nonce, verdict and definition date.
Use a memory-backed ClamAV temporary directory and disable ingress/body logs.

Medical direct uploads stay encrypted and unregistered until decryption, format
validation and malware verification succeed. Scanning also covers server uploads,
doctor signature/stamp images and generated clinical PDFs. Failed files cannot
enter patient downloads/portal registration and use existing quarantine cleanup.
Unregistered encrypted objects are not displayed in the medical portal.

Migration 052 installs a service-only scan registry and guards document/result/
credential registration. The SQL gate remains disabled until the actual private
service and existing objects have passed acceptance. Application scanning defaults
to fail closed; only an explicit `MEDICAL_SCANNER_ENABLED=false` retains the old
upload behavior during a coordinated pending rollout. It creates no false clean
attestation. Once the SQL gate is active, that flag cannot bypass registration.

Host acceptance must test a clean PDF, the harmless official EICAR test string,
invalid credential, stopped scanner, stale definitions, rejected registration,
authorized download and cross-clinic denial. CI runs real ClamAV with synthetic
data only. Unit protocol fixtures are not represented as antivirus detection.

Activation requires a private server URL/secret in the application environment,
actual clean/EICAR acceptance, scanning existing medical objects, enabling
`private.upload_security.required`, and setting `MEDICAL_SCANNER_ENABLED=true`.
Production uploads must retain their existing behavior until service acceptance.

## Backup protection and key recovery

`backup-retention.mjs configure` adds a thirty-day R2 hold from each object's creation
under `voxa/`, preserving all existing/stricter holds and verifying readback. Objects
already older than thirty days are not protected by that age rule. It never enables automatic
deletion. Cloudflare account administrators can remove these rules; keep the
scheduled backup credential unable to change account retention configuration.
This is protection from object deletion/overwrite under the configured hold,
not an unchangeable compliance hold against the Cloudflare account administrator.

The updated backup runner checks retention before capture, before upload and
after hash-verified download. Do not pin that runner change until the hosted hold
is active, otherwise daily backups would fail. The reviewed private restoration
template adds a monthly synthetic staging recovery rehearsal; it does not receive
the production patient key or pretend to restore the live production environment.

`recovery-key-export.mjs` prepares four local owner recovery entries: the entire
staging/production patient keyrings (including stable index keys) and the separate
backup archive keys. The ignored import file is sensitive plaintext intended only
for the owner's encrypted password manager; it is never sent to R2/GitHub or
included in database/Storage archives. The Windows account's previous DPAPI copies
remain useful locally but cannot replace an off-device, portable recovery copy.

Select the existing password manager, import into private secure notes, then
verify that an independent device can recover the saved values. Compare the
complete keyrings, not just their active key IDs. Only then remove the temporary
plaintext import. Keep old keys for as long as any retained archive/object needs
them. No vault import or independent-device recovery is claimed by this script.

## Current evidence

Code checks: the complete encrypted database/unit suite passed 316 tests; all 77
browser checks, TypeScript, lint and the optimized build passed. The final pushed
application quality run passed, as did real ClamAV clean-file/EICAR/unauthorized
acceptance: https://github.com/hypeskall/voxa-os/actions/runs/38280310147.

Staging and production migrations 051–053 match 1,827 catalog checks. Hosted
staging acceptance passed MFA, encrypted patient fields and public booking,
reception upload/portal download, idle/absolute/revoked-session denial, export
password confirmation, and expired-page locking. Production was reopened on
13 October 2026 at https://voxa-gw2qwdilg-voxa6.vercel.app; both application
origins were verified to return normal login pages with HTTP 200 and `no-store`. Production
patient-field access and both encrypted medical objects were verified again.

Monthly isolated recovery is installed in the existing private runner. Its first
run passed recovered password login, encrypted fields, private files, tenant
isolation and the live session gate:
https://github.com/hypeskall/voxa-backup-runner/actions/runs/38280317635.
The existing daily backup job remains on its previously reviewed source until
retention activation; its latest run also passed.

Scanner hosting/activation and retention changes are pending account access. The
existing Cloudflare management credential returned HTTP 403 for retention writes
and scanner hosting; readback on 13 October confirmed no active hold. No failed
write is represented as protection. Production explicitly retains
`MEDICAL_SCANNER_ENABLED=false` and the SQL scan gate remains disabled until the
private host and existing objects pass acceptance.

The owner selected an existing password manager. Four recovery entries have been
prepared locally with Windows owner/SYSTEM file access only, but vault import and
independent-device verification are pending. The temporary plaintext import must
be removed after that verification. No off-device key recovery is claimed yet.
Future exports restrict an empty Windows file before writing key bytes; a synthetic
Windows check verified the ACL and refusal to overwrite an existing recovery copy.
