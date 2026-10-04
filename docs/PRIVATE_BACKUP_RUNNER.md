# Daily private backup runner

The owner approved the exact private GitHub destination and six credential transfers below. The runner is installed, and its first manual cloud execution succeeded on 4 October 2026, including encrypted upload and downloaded-byte verification. The owner confirmed receiving the controlled failure alert and saving a separate recovery-key copy. The first real scheduled trigger and full hosted restore remain separate acceptance checks.

## Concrete destination and schedule

- The separate **private** repository [`hypeskall/voxa-backup-runner`](https://github.com/hypeskall/voxa-backup-runner) is created. No collaborators, deploy keys, Pages or public artifacts were added.
- `private-backup-workflow.yml.example` is installed as `.github/workflows/backup.yml`, pinned to tested Voxa revision `40d93fc79f33169976466d45afa737c971f03de0`. Dependencies use that commit's lockfile, and code does not follow future `main` changes automatically.
- Run daily at 00:17 UTC (03:17 in Bucharest summer time; 02:17 in winter), plus a first manual verification. No automatic expiry/deletion of archived data is introduced.
- GitHub Free includes a [private-runner minute allowance](https://docs.github.com/en/actions/reference/limits). This workload must stay within the account's available allowance; no paid budget or upgrade is authorized. [Scheduled runs may be delayed](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), so this is a pilot schedule rather than a guaranteed recovery-point SLA.

## Exact credential request

Only these six encrypted Actions secrets were saved in the named private repository; the name/count readback passed:

1. `SUPABASE_BACKUP_READ_TOKEN`: a **new**, project-scoped Supabase token restricted to production `fibcbsdattoqiyizzeda`, **Database: Read** only. [Supabase recommends scoped tokens](https://supabase.com/docs/guides/platform/personal-access-tokens); the existing general operator token remains local. Read-only production SQL passed; access to staging SQL and production Auth configuration returned 403. The owner-generated token has 90-day validity: rotate before 2 January 2027, update this single Actions secret and manually verify the job again.
2. `SUPABASE_SERVICE_ROLE_KEY`: existing production Storage server key, needed to list/download private files. This key can bypass application permissions; protect runner access accordingly. It is not a read-only key.
3. `BACKUP_ENCRYPTION_KEY`: production archive encryption key, kept outside R2; the owner must also hold a separate recovery copy in a password manager or other private custody.
4. `R2_ACCESS_KEY_ID` and 5. `R2_SECRET_ACCESS_KEY`: existing credentials restricted to the EU backup bucket.
6. `CLOUDFLARE_API_TOKEN`: existing read-only R2 configuration token.

No SMTP password, Vercel token, controlled user password or classic Supabase account token is exported. Set `PRIVATE_BACKUP_RUNNER_APPROVED=true` only after owner approval of this precise proposal. The preparation script checks GitHub's live repository metadata and refuses public/foreign repositories, unsupported triggers, malformed credentials and non-scoped Supabase tokens.

## Acceptance before calling scheduling complete

Verify repository privacy and secret-name readback, then manually dispatch once and verify the R2 object/download result. Confirm owner failure-alert notification settings and receipt with a controlled failed workflow. Observe a real scheduled execution and record it separately; a manual dispatch alone does not establish scheduled triggering. Rehearse full Auth/private-table/Storage restore in an isolated authorized target. Until then, the corresponding production-readiness gates remain open.

## Hosted execution evidence

- [First manual backup run](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37209238564): `success`. The cloud job completed the same fresh-capture, private-destination, encryption and download-integrity checks as the tested local operator. Private run links require the owner's GitHub login.
- [Controlled failed-workflow test](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37209397084): intentional `failure` before checkout/private credentials/data access, using manual input `test_failure=true`. Normal daily/manual executions default to `false`. The owner reported receipt of the matching GitHub failure email. Alert Inbox receipt and separate recovery-key custody are owner-confirmed; no copy of the key was requested in chat or sent to R2.
- [Final normal run after the alert test](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37209668678): `success`, confirming that default normal execution still captures/uploads/downloads/verifies backups with the final workflow. Cloudflare's object list shows the local staging/production copies and the two cloud production copies.
- The daily cron is installed at 00:17 UTC. The first scheduled trigger has not yet been observed. No private archives or receipts were uploaded to GitHub artifacts, no retention deletion was enabled and no full hosted restore is claimed.
