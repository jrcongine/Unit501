# Customer accounts and saved records: private beta foundation

This change preserves the current football/NBA tools and owner Basic Authentication. Customer accounts are **disabled by default**. No production environment, billing, or deployment changes are part of this implementation.

## Implemented

- Separate, invitation-only customer accounts, with passwords salted and derived using Node's scrypt. No plaintext passwords or invitations are saved.
- Random server-side sessions. Only token hashes are stored. Browser cookies are HttpOnly, SameSite=Strict, and Secure for HTTPS; sessions expire after seven days, and signing out revokes the session. An account can have at most five active sessions.
- Same-origin checks on account writes, JSON/body-size validation, in-process request throttling, and a restricted list of read-only sports API routes for customers. Provider usage and roster-maintenance controls remain owner-only.
- A customer account page at `/account.html` with signup, sign-in, sign-out, and explicit save/load of War Room and forecast archives.
- Per-account record isolation and revision checks. A stale device receives HTTP 409 rather than overwriting a newer save. Restarting the process retains sessions and saved records when the configured storage directory persists.
- Existing browser history is never imported on signup/sign-in. Saving requires a deliberate confirmation naming the account. Loading downloads a browser backup before replacing the local archives. Closing other dashboard tabs before loading prevents stale in-memory pages from writing over the loaded records.
- Writes use a temporary file, restrictive file permissions, file sync, atomic rename, and directory sync. Corrupt stores return an unavailable error; they are not silently replaced with an empty store.

## Configuration for a separate test deployment

Set these values through deployment settings, never in Git:

| Variable | Value |
| --- | --- |
| `UNIT501_CUSTOMER_ACCOUNTS` | `1` to enable; omit to preserve owner-only behavior |
| `UNIT501_PUBLIC_ORIGIN` | The exact HTTPS site origin, without a path/query; HTTP localhost is permitted for local development |
| `UNIT501_ACCOUNT_DATA_DIR` | An absolute path on a private persistent volume, outside the public application directory |
| `UNIT501_BETA_INVITE` | A randomly generated secret of at least 32 characters; share privately with invited testers |
| `UNIT501_PRIVATE_PASSWORD` | Retain the existing owner password |

The runtime refuses to start with enabled accounts and an unsafe/missing origin or storage configuration. Missing/short invitation configuration blocks registration. Do not expose the data volume as static content. Back up the data directory separately, with restricted access; it contains emails, password hashes, session hashes and saved records.

The first store is created when an account is created. There is a hard cap of 100 beta accounts and 1 MB of saved records per account. The invitation is not proof of email ownership. The service stores emails in normalized lowercase form. Only the two existing archives are saved; manual line settings and other browser preferences are not synchronized.

## Deliberate beta limits

This is a single-process file store. Run one replica against one durable directory. Do not use cluster workers, autoscaling or multiple deployments sharing the file. Request throttles are in memory and reset when the process restarts. The aggregate authentication throttle uses the direct socket address, so a reverse proxy can make it a shared limit across testers; forwarded addresses are not trusted by default.

This phase provides explicit account backups and restores, not automatic live synchronization. Data on the browser remains visible to the next person using that browser after customer sign-out. Use private devices in this beta; shared-device data separation must be completed before public customer access. If a browser refuses storage writes or the account is over quota, existing cloud data is retained. Local restore has a rollback attempt and a downloaded backup for recovery; browsers control whether a download completes.

Before a paid/public launch, complete email verification and account recovery, account deletion/export workflows, per-user browser storage, production monitoring and tested backup restore, a scalable transactional database, and billing with verified subscription entitlements. Beta accounts currently receive beta access, not a paid entitlement. NBA models remain unfinished; this change does not activate projections or background push notifications.

## Validation

Account integration tests exercise invitation/origin/password requirements, session cookie flags, hash-only persistence, cross-account isolation, restart persistence, concurrent-save conflicts, invalid/oversized records, logout and expiry, disabled accounts, owner-only API isolation, throttling, and corrupt-store behavior. Run `npm test` for these and all existing regressions.

Authenticated production feeds and device visual QA remain separate checks. Enabling production accounts requires the persistent volume and the remaining beta/public-launch decisions described above.
