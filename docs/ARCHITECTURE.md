# Voxa OS — arhitectură

## Boundaries

App Router pages compose the interface. `features/auth` owns session verification and request-scoped access context; `features/settings` owns validated mutations. `lib/supabase` owns database clients; `lib/permissions` owns permission identifiers. PostgreSQL `role_permissions` is the single authority for role grants. UI checks only hide actions; server actions and SQL enforce them independently. Server Components fetch user-scoped data, without a service key. No TanStack Query is needed for these server-rendered administrative workflows.

## Data and authorization

An organization contains clinics. Each membership carries `organization_id` and `clinic_id` with a composite foreign key; identity is immutable to authenticated callers. A role applies to one clinic. Organization ownership permits organization management and creating locations, but does not silently expose clinical data from other locations. Permissions are read from current memberships, never from mutable auth metadata or stale JWT role claims. Revoked memberships immediately lose database access.

`OWNER` are toate permisiunile organizației și clinicii. `ADMIN` are toate permisiunile clinicii. `RECEPTION` gestionează pacienți, programări și documente. `DOCTOR` accesează documente și rezultate prin afilierea proprie și poate valida/publica rezultate. `ASSISTANT` are acces de citire restrâns. Toate granturile sunt pe clinică.

Browserul primește numai cheia publishable. Autentificarea și accesul folosesc cookie-uri HttpOnly, SameSite=Lax și Secure în producție. Cheia `service_role` există numai în module `server-only`, pentru workerul de notificări și invitațiile portalului, nu pentru autorizarea obișnuită a datelor clinice.

Public email registration and password recovery use Supabase Auth with PKCE callbacks and allowlisted application destinations. The canonical APP_ORIGIN controls authentication and invitation links. New accounts without membership history can create an organization. Owners resume the eight-step database-backed setup; clinic routes reject incomplete setups. Existing organizations are backfilled as completed. Suspended accounts cannot bootstrap ownership to bypass suspension. Patient identities remain separate, using magic links without staff grants.

Privileged database functions use a fixed empty `search_path`, fully qualified objects, explicit identity checks, limited grants, transactional operations and per-clinic locks. Self-access changes, ADMIN→OWNER escalation and removal of the last clinic owner are forbidden. Application paths use an access check even when called independently of their layout.

Audit rows are database-generated and append-only to app callers. They contain actor, clinic, organization, entity identifiers, changed field names and timestamps, not full data snapshots. Organization renames fan out to their clinic audit streams. Login events are written only after successful authentication. Failed login attempts are handled in Auth logs, without passwords in application logs.

## SaaS lifecycle and privacy

`organization_members` projects current clinic memberships and supports multiple organizations without granting cross-location clinical access. Owners alone can edit setup drafts and organization identity. Draft revisions protect concurrent changes; finalization checks tenant relationships and atomically creates locations, hours, services, doctors, affiliations and optional rooms/invitations. Migration 032 adds authoritative organization subscriptions, automatic 30-day trials, owner-only license redemption, audit events and database-enforced expiry. See [subscription operations](SUBSCRIPTIONS.md).

Invitations use 256-bit random tokens, stored only as SHA-256 hashes. Acceptance checks confirmed matching Auth email, expiry, revocation, replay and the inviter's current grant. Links are delivered manually. Finishing setup preserves the one-time link response before navigating to the dashboard.

Clinical notes and the personal doctor schedule require current membership and professional affiliation. A doctor sees patients attached to their own appointment workflow, not the full patient registry. Owner-only exports and reviewed privacy requests preserve audit history. Medical Storage authorization validates clinic, patient and doctor path segments against database records, including cleanup of unregistered failed uploads. Branding uses a separate private bucket.

Uploads are limited to 3 MB combined per form with a 4 MB Server Actions body limit. Client feedback and server content checks agree; the larger legacy bucket caps are retained for existing objects. Hosted email verification, Storage HTTP and multi-connection scheduling require staging tests beyond the local PGlite/Auth protocol fixtures.

## Visual foundation details

Warm neutral background, white surfaces, charcoal text, medical green accent. Radius 4–8px, compact 38–40px controls, hairline separators and restrained 160ms transitions. Shared tokens live in `globals.css`; shadcn-style CVA/Slot controls and Radix dialogs/tooltips support keyboard focus, Escape and focus restoration. Drawers reuse the accessible dialog primitive. Native selects prioritize reliable keyboard interaction. Motion is disabled under reduced-motion preferences. Desktop sidebar collapses; mobile uses a drawer. Only implemented routes appear in navigation.

## Administrative operations

The clinic home is a current-day operational view backed by one permission-aware PostgreSQL function. It returns compact metrics, the next appointments, actionable counts and a bounded activity stream; roles without appointment access receive no scheduling data. Reports are aggregated in PostgreSQL for a bounded date range and optional doctor/service filters. CSV exports contain aggregates rather than patient rows and add an immutable audit event.

Global search uses a POST body and a tenant-scoped SQL function. Each result category is included only when the caller holds its underlying permission, and results are capped before reaching the browser. Personal preferences store density, default clinic, calendar view/filters, visible patient columns and enabled dashboard sections without local storage. Audit remains append-only and adds user, date, action, entity and location filters while displaying only allowlisted metadata keys.

## Core Clinic Data

`features/core-clinic` is the shared feature boundary for nine related registries. Module metadata defines fields, columns and permission identifiers; server-side Zod schemas and PostgreSQL constraints validate independently. Registry queries use a fixed SQL allowlist, stable sorting and 25-row pagination. Patient search uses POST bodies, never patient identifiers in URLs. Client payloads for registries contain only visible columns. No sensitive data is stored in localStorage.

Patients, specialities, categories, services, rooms and equipment are clinic scoped. Composite foreign keys prevent cross-clinic relations even inside one organization. Doctors have organization identity and separate clinic affiliations. Affiliation IDs identify local services, specialities, usual rooms and availability. Adding another location requires catalog management in both locations. Changing shared identity requires management in every affiliated clinic. Signature and stamp scans use private storage on the local doctor affiliation and are not represented as qualified electronic signatures. Optional CNP and creator attribution are stored in the patient record; paginated lists omit CNP and clinical free text, and the personal doctor projection includes only the minimum patient identity.

All records support active/inactive, archive and restore. There are no hard-delete grants. Edits use `updated_at` as an optimistic concurrency token. Transactional RPCs atomically replace eligible doctors/rooms/equipment and reject inaccessible, inactive or archived targets. Reverse doctor/service relations are the same normalized link rows, not duplicated lists. Catalog workflows use clinic advisory locks; shared doctor workflows additionally use an organization lock. Audit contains identifiers and changed field names, never patient notes or values. Patient history has a separate permission-checked RPC that exposes only that patient's events.

Availability stores weekday, local wall-clock intervals, inclusive validity dates and work/break type for clinic, doctor, room or equipment. Weekly intervals of the same type cannot overlap for one resource; adjacent intervals and breaks inside work are valid. Exceptions use explicit UTC instants plus the clinic timezone for display. Closed, holiday, leave, maintenance, meeting and manual blocks subtract availability; extra work adds it. Server conversion rejects nonexistent and ambiguous DST boundary times instead of silently shifting an interval.

## Scheduling engine

`features/scheduling` is server-only. Zod validates every public domain input before a typed Supabase RPC call. PostgreSQL remains authoritative: each RPC checks the current database membership, verifies patient/service/resource tenant identity and recomputes eligibility, work intervals, breaks, exceptions, buffers, capacity and existing reservations.

Services specify whether a doctor and room are required, the minimum room capacity, eligible doctors/rooms, duration and buffers. Equipment rows are grouped by `requirement_group`: every group is required and its rows are alternatives. The resolver evaluates complete room/equipment combinations and prefers a doctor's usual room when possible. Appointment rows snapshot duration and buffers; resource rows record consumed capacity. Cancellation keeps those rows for history while the cancelled status removes them from conflict calculations.

Create, reschedule, cancel and status transitions are database transactions. A transaction-scoped advisory lock derived from `clinic_id` serializes reservation changes in one clinic. The engine repeats all checks after taking that lock, then writes the appointment, resource allocation, history and audit atomically. Authenticated callers have SELECT-only table grants; writes are possible only through permission-checked RPCs. Rescheduling uses an optimistic `updated_at` token and excludes its own appointment during conflict checks. A failed validation performs no mutation.

Duplicate detection warns for the same patient/service within 24 hours. It requires an explicit override and the separate `appointments.override` permission, and records the override in appointment history. History snapshots scheduling fields and resource IDs, while general audit metadata omits notes and patient values.

Migrations `202609280008`–`010` add the appointment model/RLS/indexes, transactional scheduling functions and service requirement configuration. `seed-core.sql` remains separate from migrations and contains fictional development data only.

## Calendar and reception workflow

`features/calendar` keeps view/range parsing, bounded calendar reads and all reception mutations in one feature boundary. Day and week use a dense 15-minute time grid; month and agenda reuse the same range-limited SQL result. A single SQL function joins the visible patient, service, doctor and allocated resource labels, applies all filters and caps requests at 62 days, so the UI does not issue per-appointment lookups. The selected view and filters are stored in `user_preferences`.

Every create and reschedule action calls the Phase 3 scheduling API. Drag-and-drop updates only local position optimistically, then submits the move with the appointment concurrency token; conflicts restore the original record and show the server result. Service duration initializes each appointment; permission-checked resizing revalidates availability and preserves duration changes in history. The detail drawer loads contact, resources and immutable appointment history on demand, and exposes only permission-checked transitions. Inline patient creation uses the existing tenant-scoped patient workflow.

## Public booking

`features/public-booking` provides one mobile-first React flow for `/book/[clinicSlug]` and the compact `/embed/booking/[clinicSlug]` route. Service and doctor query parameters allow safe preselection. The public catalog exposes only active booking clinics and the minimum service/doctor/location fields needed by the flow. It never includes patients, internal notes, rooms, equipment, schedules or audit data.

The public route handlers validate strict Zod contracts and call four narrow `anon` RPCs. Availability delegates to the existing assignment resolver. Creation takes only clinic slug, service, optional doctor, start and contact data; PostgreSQL rechecks tenant/service/doctor eligibility and availability while holding the same per-clinic advisory lock used by reception. The shared internal creation function writes the appointment, resources, history and audit atomically. Website bookings use source `WEBSITE` and a system actor (`NULL`) without a privileged browser key.

Rate limits are stored in the private schema and evaluated in PostgreSQL for both clinic scope and a salted request fingerprint. Same-origin checks, JSON-only POST, a honeypot and minimum interaction time add low-cost abuse resistance. Exact normalized email/phone matching can reuse a clinic patient internally, but the API response never discloses whether a patient already existed. Availability responses and booking mutations use `no-store`; the widget refreshes selected-day availability every 30 seconds and creation always revalidates under the database lock.

Migration `202609280011` adds public-booking clinic settings, calendar preferences, anonymous-safe RPCs, the private limiter and the shared create path. `anon` receives execute rights only for the three sanitized public RPCs. Appointment tables remain protected by RLS and are never granted directly to anonymous users.

## Confirmations and notifications

Confirmation links combine a random public identifier, an expiry and an HMAC signature. PostgreSQL stores only SHA-256 digests; issuing a replacement revokes the prior token. Public RPCs expose only one appointment and enforce expiry, revocation, rate limits and the clinic cancellation policy. They do not establish a patient session.

Notification business logic targets a provider interface. The development provider logs masked metadata only; the production webhook adapter requires explicit credentials and sends an idempotency key. PostgreSQL owns templates, jobs, attempts, statuses and audit events. Unique idempotency keys prevent duplicate appointment events and reminder offsets. A GitHub Actions schedule invokes the secured server-only worker endpoint every five minutes; `CRON_SECRET` must match in GitHub and Vercel.

## Medical documents, results and portal

The `voxa-medical` bucket is private. Storage paths encode clinic and patient or doctor identity, and storage RLS checks both path and current authorization. Every download first calls an authorization RPC and then creates a 60-second signed URL. Patient-visible flags are explicit.

Results use `DRAFT → VALIDATED → RELEASED`. Each save and transition creates a version, while audit metadata omits result content. Release generates an A4 PDF with embedded Romanian font and optional signature/stamp scans, uploads it privately and only then exposes it to the patient. The portal uses its own layout and patient identity mapping; its RPCs show only the linked patient's appointments, explicitly shared documents and released results.

Migration `202609290012` adds these tables, policies, RPCs, storage policies, notification defaults and audit hooks.

## Verification scope

Unit tests validate inputs, timezone behavior and permission gates. PGlite executes the unmodified migrations on PostgreSQL WASM, with authenticated/anonymous roles and `auth.uid()` request context. Tests cover all CRUD workflows, 21 scheduling scenarios and the Phase 4 reception/public cases: shared visibility, availability refresh after create/reschedule/cancel, collision rollback, public concurrency, invalid doctor/service input, anonymous boundaries and cross-clinic isolation. Browser tests call production server actions and public route handlers through a test-only HTTP adapter backed by these same SQL functions and RLS. Auth protocol responses remain fixtures. PGlite uses one connection, so its concurrent-attempt assertions prove serialized behavior; the migration's advisory lock is the production cross-connection guard. Staging should still run a multi-connection load test against hosted PostgreSQL before public booking is enabled.
