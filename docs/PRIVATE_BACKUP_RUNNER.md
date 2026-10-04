# Prepared daily private backup runner

The owner approved this exact private GitHub destination and the six credential transfers below. Installation is pending generation of the dedicated read-only Supabase token and a successful first hosted run. The first encrypted staging/production backups are already verified in private EU R2.

## Concrete destination and schedule

- Create a separate **private** repository `hypeskall/voxa-backup-runner`, without collaborators, deploy keys, Pages or public artifacts.
- Install `private-backup-workflow.yml.example` as `.github/workflows/backup.yml`, substituting the tested 40-character Voxa implementation commit. Dependencies use that commit's lockfile, and code does not follow future `main` changes automatically.
- Run daily at 00:17 UTC (03:17 in Bucharest summer time; 02:17 in winter), plus a first manual verification. No automatic expiry/deletion of archived data is introduced.
- GitHub Free includes a [private-runner minute allowance](https://docs.github.com/en/actions/reference/limits). This workload must stay within the account's available allowance; no paid budget or upgrade is authorized. [Scheduled runs may be delayed](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), so this is a pilot schedule rather than a guaranteed recovery-point SLA.

## Exact credential request

Save only these six encrypted Actions secrets in the named private repository:

1. `SUPABASE_BACKUP_READ_TOKEN`: a **new**, project-scoped Supabase token restricted to production `fibcbsdattoqiyizzeda`, **Database: Read** only. [Supabase recommends scoped tokens](https://supabase.com/docs/guides/platform/personal-access-tokens); the legacy account-wide operator token must remain local. Test that a read-only database query succeeds and access to unrelated projects/configuration is denied before enabling the schedule.
2. `SUPABASE_SERVICE_ROLE_KEY`: existing production Storage server key, needed to list/download private files. This key can bypass application permissions; protect runner access accordingly. It is not a read-only key.
3. `BACKUP_ENCRYPTION_KEY`: production archive encryption key, kept outside R2; the owner must also hold a separate recovery copy in a password manager or other private custody.
4. `R2_ACCESS_KEY_ID` and 5. `R2_SECRET_ACCESS_KEY`: existing credentials restricted to the EU backup bucket.
6. `CLOUDFLARE_API_TOKEN`: existing read-only R2 configuration token.

No SMTP password, Vercel token, controlled user password or classic Supabase account token is exported. Set `PRIVATE_BACKUP_RUNNER_APPROVED=true` only after owner approval of this precise proposal. The preparation script checks GitHub's live repository metadata and refuses public/foreign repositories, unsupported triggers, malformed credentials and non-scoped Supabase tokens.

## Acceptance before calling scheduling complete

Verify repository privacy and secret-name readback, then manually dispatch once and verify the R2 object/download result. Confirm owner failure-alert notification settings and receipt with a controlled failed workflow. Observe a real scheduled execution and record it separately; a manual dispatch alone does not establish scheduled triggering. Rehearse full Auth/private-table/Storage restore in an isolated authorized target. Until then, the corresponding production-readiness gates remain open.
