# Daily private backup runner

The owner approved the exact private GitHub destination and six backup credentials below. Manual cloud backups, downloaded-byte verification, owner failure-alert receipt and separate key custody passed. An additional explicitly approved staging key supports the successful isolated restoration below. [Current acceptance](ACCEPTANCE_1_4_2026-10-04.md) records the real scheduled-trigger check separately.

## Concrete destination and schedule

- The separate **private** repository [`hypeskall/voxa-backup-runner`](https://github.com/hypeskall/voxa-backup-runner) is created. No collaborators, deploy keys, Pages or public artifacts were added.
- `private-backup-workflow.yml.example` is installed as `.github/workflows/backup.yml`, pinned to tested Voxa revision `40d93fc79f33169976466d45afa737c971f03de0`. Dependencies use that commit's lockfile, and code does not follow future `main` changes automatically.
- Run daily at 00:17 UTC (03:17 in Bucharest summer time; 02:17 in winter), plus a first manual verification. No automatic expiry/deletion of archived data is introduced.
- GitHub Free includes a [private-runner minute allowance](https://docs.github.com/en/actions/reference/limits). This workload must stay within the account's available allowance; no paid budget or upgrade is authorized. [Scheduled runs may be delayed](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), so this is a pilot schedule rather than a guaranteed recovery-point SLA.

## Exact credential request

The daily backup loads these six encrypted Actions secrets; the original name/count readback passed:

1. `SUPABASE_BACKUP_READ_TOKEN`: a **new**, project-scoped Supabase token restricted to production `fibcbsdattoqiyizzeda`, **Database: Read** only. [Supabase recommends scoped tokens](https://supabase.com/docs/guides/platform/personal-access-tokens); the existing general operator token remains local. Read-only production SQL passed; access to staging SQL and production Auth configuration returned 403. The owner-generated token has 90-day validity: rotate before 2 January 2027, update this single Actions secret and manually verify the job again.
2. `SUPABASE_SERVICE_ROLE_KEY`: existing production Storage server key, needed to list/download private files. This key can bypass application permissions; protect runner access accordingly. It is not a read-only key.
3. `BACKUP_ENCRYPTION_KEY`: production archive encryption key, kept outside R2; the owner must also hold a separate recovery copy in a password manager or other private custody.
4. `R2_ACCESS_KEY_ID` and 5. `R2_SECRET_ACCESS_KEY`: existing credentials restricted to the EU backup bucket.
6. `CLOUDFLARE_API_TOKEN`: existing read-only R2 configuration token.

A seventh secret, `STAGING_BACKUP_ENCRYPTION_KEY`, was separately authorized and saved only for the isolated restoration workflow. That workflow loads no production Supabase credential or hosted user password. No SMTP password, Vercel token, controlled user password or general Supabase operator token is exported. The preparation code checks live repository privacy and refuses foreign/public targets and malformed credentials.

## Acceptance before calling scheduling complete

Manual capture/transfer, failure-alert receipt, key custody and complete isolated recovery passed. Observe a real `schedule` execution and record it separately; a manual dispatch does not prove triggering. Retention and guaranteed recovery objectives require an operator decision.

## Hosted execution evidence

- [First manual backup run](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37209238564): `success`. The cloud job completed the same fresh-capture, private-destination, encryption and download-integrity checks as the tested local operator. Private run links require the owner's GitHub login.
- [Controlled failed-workflow test](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37209397084): intentional `failure` before checkout/private credentials/data access, using manual input `test_failure=true`. Normal daily/manual executions default to `false`. The owner reported receipt of the matching GitHub failure email. Alert Inbox receipt and separate recovery-key custody are owner-confirmed; no copy of the key was requested in chat or sent to R2.
- [Final normal run after the alert test](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37209668678): `success`, confirming that default normal execution still captures/uploads/downloads/verifies backups with the final workflow. Cloudflare's object list shows the local staging/production copies and the two cloud production copies.
- [Complete isolated restoration](https://github.com/hypeskall/voxa-backup-runner/actions/runs/37211801266): success with pinned source `64e09697872d18f4f2430f7ca0a29ed2cb8e297b`, 77 Auth/application/private data tables matching, two actual files recovered, both accounts normally authenticated and foreign/anonymous access denied. The local provider migration history was retained, and the disposable stack removed. No hosted project was reset.
- Daily cron remains 00:17 UTC. See the current acceptance report for real scheduled-run evidence. No private archives/receipts were uploaded as GitHub artifacts; no retention deletion was enabled.
