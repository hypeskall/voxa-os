# Private off-device backup setup

The private EU R2 bucket, approved encrypted staging/production transfers, private daily runner, manual cloud backup, failure-alert receipt and separate key custody are verified. Full Auth/application/private/Storage restoration also passed in a disposable private runner on 4 October: 77 data tables and two actual files were compared, restored accounts logged in and tenant/file isolation passed. See [current acceptance](ACCEPTANCE_1_4_2026-10-04.md) for scheduled-trigger and email Inbox status.

## Owner account step

Create/sign in to [Cloudflare](https://dash.cloudflare.com/sign-up) and enable R2 only after reviewing its checkout/billing terms. R2 has [included monthly free usage, followed by usage-based billing](https://developers.cloudflare.com/r2/pricing/); it is not an unconditional zero-cost subscription. No subscription or card entry was performed by this task.

Create a **Standard** bucket named `voxa-private-backups`, with **EU jurisdiction**, rather than only a European location hint. [Jurisdiction and location hints have different guarantees](https://developers.cloudflare.com/r2/reference/data-location/). Disable the `r2.dev` domain and custom domains. Keep the bucket private; do not create public sharing links or a Worker exposing its contents.

Create bucket-scoped S3 object read/write credentials and a separate read-only Cloudflare management token capable of reading the bucket's managed/custom-domain settings. The operator checks both before each upload and refuses unknown/public states. A missing read permission stops transfer; there is no privacy-check bypass switch.

Place credentials directly in ignored `.env.backup.local`, using `.env.backup.example` as the template. Do not paste them in chat, GitHub source/artifacts or Vercel. Leave `R2_UPLOAD_APPROVED=false` until the owner authorizes the exact account/bucket and source project. Keep `BACKUP_ENCRYPTION_KEY` in the named source operator environment and in separate owner-controlled custody, never in the R2 bucket.

## Concrete transfer

1. `npm run backup:check` performs read-only private-domain checks; it does not upload or prove object write permissions.
2. Capture a current encrypted archive with `node scripts/recovery-snapshot.mjs capture`, or set `RECOVERY_ENV_FILE=.env.staging.local` for synthetic rehearsal.
3. Once transfer is approved, set `R2_APPROVED_PROJECT_REF` to the exact approved source project and `R2_UPLOAD_APPROVED=true` locally.
4. `npm run backup:upload -- .backups/FILE.voxa` authenticates/decrypts the archive locally, checks bucket privacy, conditionally uploads ciphertext and downloads it to compare size/SHA-256. Only then is an external verification receipt written locally. It uploads no keys or plaintext, creates no bucket/subscription, deletes nothing and does not overwrite an existing object.
5. Repeat with synthetic staging before an approved production transfer. The existing archive format remains compatible with the extracted codec. The logical tool handles at most 128 MiB decompressed JSON and 100 MiB ciphertext; move to suitable database/object-backup tooling before those limits.

## Schedule and recovery remain separate gates

Choose an approved always-on private runner and agree backup interval, retention and recovery objectives. Do not put the database operator token, service key or encryption key into the current public GitHub repository's workflows without explicit approval of that new destination/access. A Windows task running on a laptop cannot promise backups while the laptop is off. No automatic deletion/retention policy is inferred or enabled.

`npm run backup:run` is the installed runner's one-run entry point: it validates source/destination, checks privacy, captures an encrypted archive, rejects stale/replaced receipts, transfers/downloads/verifies bytes, and writes evidence after success. It suppresses diagnostics and creates no schedule itself. Synthetic staging uses its distinct named environment and destination approval.

The installed private GitHub pilot runner, exact credential list, source workflow template and execution evidence are in [PRIVATE_BACKUP_RUNNER.md](PRIVATE_BACKUP_RUNNER.md). The owner approved the named credential destination and the first hosted manual backup passed. The public repository contains only the inactive template, never the private Actions secrets or backup artifacts.

The approved restoration workflow template is `private-restore-workflow.yml.example`. It starts a real disposable Supabase Auth/PostgreSQL/Storage stack on a private Linux runner, loads only the approved staging/R2 credentials, compares records and file hashes, verifies normal recovered account login and isolation, then removes services/diagnostics. A logical archive is not physical backup/PITR. Agree retention/recovery objectives separately; notification delivery remains disabled in this isolated restoration workflow. Production email was activated separately on 5 October. Scheduled-backup follow-up remains deferred to 6 October; this documentation correction does not execute it.
