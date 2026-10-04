# Account verification in two steps

Migrations 034–035 and the app implement optional TOTP MFA. Once a user verifies a factor, AAL2 is required for private application data, clinic pages, app password reset and private downloads. Existing users without factors retain normal login. Migration 035 also guards the entry of the two SQL wrappers that previously delegated to guarded functions, making denial independent of expression short-circuiting.

## User flow

Open **Settings → Security → Verificare în doi pași**, or `/account/security`. Choose **Configurează aplicația**, scan the QR with a TOTP authenticator and confirm its six-digit code. Keep the setup secret in a private password manager. The app does not persist that secret in browser storage or logs and does not invent recovery codes.

The next password login opens `/auth/mfa`. Wrong/expired codes do not upgrade the session. Removing a factor requires that user's AAL2 session and explicit confirmation; the session is refreshed afterward. Interrupted unverified TOTP enrollments can be replaced by the same signed-in user.

## Data boundary

All public application RLS tables and `storage.objects` have an additional restrictive MFA policy. Authenticated PL/pgSQL RPCs check MFA before their existing permission checks; the authenticated SQL permission RPC filters on the helper. Anonymous public-booking capability checks remain active. The helper reads current verified factors from provider-owned Auth data, preventing stale password-only sessions from retaining private access. The app asks Auth for current factors using the access token instead of trusting cached cookie user metadata.

New migrations must retain the guards. Database tests reject application tables without the restrictive policy or authenticated private RPCs without MFA enforcement. App guards supplement this database boundary.

## Lost authenticator

1. Reconfigure a new authenticator with the privately retained setup secret.
2. If the secret is also lost, the password recovery email cannot bypass MFA. Contact support.
3. An operator must establish the person's identity and authority using independent previously verified account/clinic evidence before removing an exact factor through Supabase's administrative Auth tools. An incoming email or supplied account ID alone is insufficient.
4. Record justification, approval, UTC time and user/factor IDs in the private operations record. Preserve other users' factors. Revoke compromised sessions, have the user log in and enroll again, then verify tenant permissions. Never collect a secret or one-time code in a support ticket.

Personal phone enrollment is performed by the owner. Acceptance enrolled/removed only a newly created factor on the controlled synthetic staging account. See [current acceptance](ACCEPTANCE_1_4_2026-10-04.md).
