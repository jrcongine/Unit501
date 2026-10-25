# UNIT501 account-test deployment validation — October 25, 2026

## Deployment

- Test service: `Unit501-account-test` in the existing `humble-amazement` project.
- Account page: https://unit501-account-test-production.up.railway.app/account.html
- This is a separate test service in the project's existing `production` environment, not a newly created Railway environment. Its variables, domain, volume and deployment are separate from the original `Unit501` service.
- Deployed application commit: `8c4415d4b9c1a15b5d0d2bc58ccea226256fa878`, from draft PR #138. Source is pinned to this commit, so later branch pushes do not automatically redeploy the test service.
- Persistent volume: `unit501-account-test-data`, 512 MB at `/data`; account store at `/data/accounts`.
- One replica in `sfo`. Build command `npm test`; start command `node server.js`; health check `/api/health`. Railway selected Node 24.21.0.
- Customer accounts enabled only on the test service, with independent generated owner/invitation secrets. No sports-provider credentials were copied and background roster sweeps are disabled.

## Observed results

1. Initial deployment `7e311948-21bc-4b56-91c8-4cd74f46638d` reached terminal `SUCCESS`.
2. Railway's build logs reported 443 tests, 443 passed, zero failures and zero cancellations.
3. Browser inspection confirmed the account page loads its stylesheet and script and displays the sign-in form and invitation entry. This was a desktop inspection, not iPhone/Android visual QA or a browser-form sign-in test.
4. Live HTTP tests with two synthetic accounts passed: anonymous access denied; invalid invitation rejected; foreign-origin signup and save rejected; separate account records; successful archive save; stale-revision conflict; owner-control restrictions; a second authenticated session reading the saved copy; logout revocation of the first session without revoking the second.
5. Fresh deployment `d531ecd0-3a93-4b17-aa2a-d26a020dc933` reached terminal `SUCCESS`.
6. After redeployment, both saved test sessions remained valid, the first account's saved records/revision/timestamp matched exactly, and the second account still had an empty archive. This verifies persisted state on the mounted volume across a replacement deployment.
7. The original `Unit501` service retained deployment `8c7b43a6-7e5d-4be3-97b4-079c5ec21c10` in `SUCCESS`. No changes were made to that service, its source, variables or main branch.

Two synthetic QA accounts and clearly marked test-only records remain in the isolated test store. No real customer records or wagers were used. Secrets and session tokens are not included in these notes or Git.

## Remaining work

The beta limits in `customer-accounts-beta.md` still apply. Saving/loading is explicit rather than automatic sync. Browser records remain on a device after sign-out. Public customers still need account recovery and email verification, per-user browser storage, a scalable transactional database, monitored backups and tested restore, and payment/subscription entitlements. Current sports-feed validation, mobile visual/interaction testing and background push are separate work. No paid access is enabled by this deployment.
