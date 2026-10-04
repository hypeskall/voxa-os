# Private off-device backup setup

The owner activated R2 and `voxa-private-backups` was created with EU jurisdiction, Standard storage, no custom domains and its public development URL disabled. Bucket-scoped object credentials and separate read-only privacy verification access are configured. After explicit approval, fresh staging and production archives were encrypted locally, uploaded, downloaded and verified by size/SHA-256 on 4 October 2026. No recurring backup runner is active; separate key custody and full hosted recovery remain open.

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

`npm run backup:run` is the prepared one-run entry point for that future runner: it validates the named source and approved destination, checks privacy, captures a fresh encrypted archive, rejects stale/replaced capture receipts, transfers/downloads/verifies the bytes, and writes evidence only after success. It suppresses child/provider diagnostics and creates no schedule. The same command can rehearse synthetic staging with the named environment and its separate destination-project approval.

The concrete private GitHub pilot-runner proposal, exact credential list and inactive workflow template are in [PRIVATE_BACKUP_RUNNER.md](PRIVATE_BACKUP_RUNNER.md). The owner approved the named credential destination; installation and hosted verification remain pending.

Enable the recurring job only after an initial external transfer is verified and its failure alert is tested. Full hosted Auth/private-table/Storage restoration to an isolated target must still be rehearsed. A downloaded logical archive is not PITR or proof of complete recovery. Patient notification delivery stays disabled through restoration.
