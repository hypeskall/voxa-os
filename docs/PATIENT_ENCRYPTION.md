# Patient encryption — implementation and rollout

Status: prepared locally on 12 October 2026. Production has **not** been migrated or deployed by this change. Applying migration 049 installs the tooling; it does not encrypt existing records until the separately authorized activation runs. No promise of “100% safe” or end-to-end encryption is made.

## Coverage

The database stores encrypted JSON payloads instead of readable sensitive values in twelve tables. Covered fields include patient name, internal identifier, CNP, birth date, sex, contacts and address; administrative and clinical notes; medical result titles/content/version reasons; document titles/original file names; appointment notes/cancellation reasons/history snapshots; notification recipients/errors; communication summaries and masked recipients; privacy request text; and reception task/waitlist titles/notes.

Public names become security-invoker, security-barrier views. Authorized SQL workflows see their usual values. Physical tables move to the existing non-exposed `private` schema, retain their RLS/MFA policies, foreign keys and access rules, and contain masked columns plus pgcrypto OpenPGP ciphertext using AES-256 and integrity protection. An encryption trigger also covers the notification queue's `ON CONFLICT` insert. Original CHECK constraints are evaluated before masking. Stable, separately keyed HMACs preserve identifier/CNP uniqueness.

Medical PDFs, uploaded documents and doctor signature/stamp images use AES-256-GCM envelope encryption, with a fresh random data key and nonce for each object. A server-held master key wraps the data key. Authentication binds the header, Supabase project, bucket and object path; swapping an object between patients or projects fails. New paths contain opaque identifiers rather than original file names. Direct uploads encrypt in the browser using only a one-use file key; the server verifies encryption, actual size and file content before registering the document. Download routes authenticate and authorize, then return decrypted bytes with `private, no-store`; they no longer redirect to a plaintext Storage URL.

Clinic/patient/appointment UUIDs, relationships, timestamps, statuses, service/doctor IDs and technical object paths remain queryable. These can reveal operational metadata. Audit logs retain identifiers and changed field names; clinical content is not copied into audit metadata. Auth/processor data, staff accounts and clinic identity are outside these patient tables. Emails or WhatsApp messages and deliberately exported/downloaded records are readable to their authorized recipients.

## Keys and security boundaries

`PATIENT_ENCRYPTION_KEYRING` is server-only JSON:

```json
{"active":"v1","keys":{"v1":"64 lowercase random hex characters"},"index":"64 different lowercase random hex characters"}
```

Use independent staging/production keys and an index key distinct from the data, backup, confirmation and upload-signing keys. Never use a `NEXT_PUBLIC_` variable. The application sends the ring only to the exact project's HTTPS Data API, never Auth, Storage, browser clients or notification providers; redirects are rejected. Database encryption keys are not stored in tables, Vault, JWTs, backups or function definitions. The backup runner can copy physical ciphertext without patient keys. Retain a separate owner-controlled recovery copy of every old data key and the stable index key. Losing the keys loses access to the records even if the backups survive.

Database cryptography runs inside PostgreSQL, so plaintext and request keys exist transiently there. This protects stolen database dumps/storage and ordinary unauthorized access; a malicious live database superuser, compromised application server, stolen authorized session, or modified client/server code can still expose data. PostgreSQL/provider operators remain a trust boundary. Encryption complements access controls, MFA, monitoring, patching and verified recovery; it does not replace them.

## Coordinated rollout

Complete these operations on synthetic staging first, then repeat the approved release on production. Use a maintenance window so neither old application instances nor write operations race activation/file conversion.

1. Generate a distinct local keyring using `node --conditions=react-server scripts/patient-encryption.mjs generate staging` (or `production`). This creates an ignored `.env.patient-encryption.ENV.local` without printing keys or changing remote services. Save a separate recovery copy. Transfer the same value to the corresponding private application server environment.
2. Capture/decrypt-verify a fresh encrypted recovery snapshot and verify its external backup. Apply migration 049 through the existing forward migration process. Set `PATIENT_ENCRYPTION_READ_LEGACY=true` only for the temporary file-conversion window, and deploy the tested application release with the ring configured. New writes encrypt immediately; database activation is still pending.
3. Run `node --conditions=react-server scripts/patient-encryption.mjs check staging`, then `activate staging`. Activation requires a matching, authenticated recovery archive less than one hour old. It moves/backfills all protected tables atomically, without resetting, seeding or firing clinical/audit/reminder side effects. Missing keys subsequently fail closed.
4. Run `files staging`. It inventories all private medical objects, uploads ciphertext to a new opaque path, downloads/decrypts and compares the result, replaces existing database references, and removes the old plaintext object only after those checks. Reruns verify already encrypted objects. Refresh the recovery snapshot if the one-hour gate expires. Failure never removes an original before replacement verification; a failed/interrupted run may leave encrypted orphan files, which existing cleanup can handle.
5. Run `verify staging`, remove the temporary legacy-read flag (`false`), and exercise staff/patient downloads, public booking, search, imports, reminders, reports and MFA on the hosted release. The direct-upload completion endpoint always rejects plaintext, including during migration. An abandoned/malicious signed-upload attempt can leave an unregistered object; retain orphan cleanup and inspect the bucket during acceptance.
6. Capture and restore an encrypted staging snapshot, supply the separately held patient ring only to the disposable recovery environment, and verify actual decrypted records/files. The updated restore code recreates the encrypted schema, restores physical ciphertext, verifies exact raw file recovery, rebinds file envelopes to the disposable project's URL, and proves decrypted patient reads and isolation. The private runner template uses an optional `STAGING_PATIENT_ENCRYPTION_KEYRING` secret; transferring that staging-only key and updating its pinned source require separate destination approval. Its earlier successful restore of an unencrypted schema is not acceptance evidence for this change. Production activation is gated on this hosted recovery acceptance.
7. Repeat on production only after approval of the exact release, key destination, maintenance window and migration. Update the pinned backup/restore runner to the reviewed release. Verify a post-migration backup and record hosted acceptance. No live configuration, key transfer, runner change or migration is performed automatically by merely editing this repository.

Physical backup snapshots include ciphertext-bearing `private` tables, not the decrypting views. Historical backups already use independent AES-256-GCM archive encryption; they may contain the old readable database values inside that archive. Existing retention decisions stay explicit.

Backfilling updates logical records; old PostgreSQL row versions/WAL and provider-retained file versions can persist until maintenance and retention remove them. They retain the provider's disk encryption. Rewriting tables and verifying provider retention belongs in hosted acceptance; this change does not claim immediate erasure of every historical physical copy.

## Rotation and limits

Add a new random data key under a new ID and change `active`; keep every old key until all records, objects and retained backups have been migrated/expired and recovery is proven. New database writes and files use the new key; old ones remain readable through their stored key ID. Do not rotate the stable index key by changing a variable: writes reject a mismatch to preserve uniqueness. Bulk re-encryption/index-key rotation needs a separately reviewed migration.

Decrypted text search cannot use the previous plaintext name/title indexes. Each selected physical row is decrypted once through a lateral function scan; benchmark real clinic volumes before launch. Maximum plaintext medical file size remains 20 MiB, with at most 4 KiB envelope overhead. Server downloads buffer a file in memory and recheck authorization on every request. Scheduled reminders must use the updated server client and configured ring. Legacy raw SQL clients and direct browser Data API calls cannot decrypt patient records without that server key.

Sources: [PostgreSQL pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html), [security-invoker views](https://www.postgresql.org/docs/current/sql-createview.html), and the installed Next.js data-security/route-handler guides. Local cryptographic tests cover wrong/missing keys, tampering, context swaps, rotation, browser/server compatibility and header isolation. Local database tests exercise existing workflows against real encrypted storage; hosted rollout/recovery acceptance is separate.

## Local verification, 12 October 2026

- Full suite with encrypted fixtures: 49 files, 305 tests passed. A subsequent added database key-rotation check also passed; the final focused encryption run passed all 16 checks.
- Browser checks against encrypted synthetic storage/database: 27 passed, including imports, patient edits, bookings, role isolation, ciphertext upload and a download exactly matching the original file.
- TypeScript, lint and optimized production build passed. The encrypted schema catalog was generated and checked locally (1,796 entries).
- Existing-record backfill, preserved audit counts, restoration of physical ciphertext and authenticated plaintext recovery passed locally. No hosted migration, hosted recovery run, production key installation or production deployment is claimed.
