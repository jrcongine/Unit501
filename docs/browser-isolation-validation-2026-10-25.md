# Browser record isolation validation — October 25, 2026

The account draft now separates dashboard storage by authenticated customer identity. The original owner keys are preserved. Customer archives, manual line values and observed-line history use account-specific namespaces. The server supplies the scope in authenticated HTML; a query parameter cannot select it.

An identity lease blocks old tabs after sign-out, account switches or archive restoration. A check on every storage operation blocks stale reads/writes even before a cross-tab event is delivered. A stale visible dashboard is hidden and redirected to the account page. Normal profile refreshes do not rotate the lease, preventing reload loops between account tabs. A delayed response cannot activate over a newer account switch.

Archive writes and logout require `X-Unit501-Account-ID`. A mismatched expected identity is rejected with HTTP 409, including archive reads when the header is supplied. This prevents an old tab from acting on another account after the shared browser cookie changes.

## Verification

- Local suite: 451 tests passed, zero failures, cancellations or skips. Syntax and diff checks passed.
- After merging the independent main update from PR #139, the combined draft passed all 454 local tests.
- Added tests cover owner archive preservation, two customers sharing one browser store, sign-out before event delivery, return-to-same-user leases, non-rotating profile refreshes, delayed responses, invalid scopes, stale dashboard hiding, stale-cookie API actions and authenticated HTML scope injection.
- Deployment `86518923-8b5a-4ca5-a8a3-23132ee87d07` of application commit `817c441b7d8c257849e3b2011e9be050671b219b` reached Railway `SUCCESS`. Build logs confirmed all 451 tests passed.
- The deployed account page loaded its scripts and displayed the expected signed-out form in the browser at https://unit501-account-test-production.up.railway.app/account.html.
- The original `Unit501` service separately advanced to successful deployment `850a019b-8407-4e75-95af-df5105c58da3`, running main commit `9ec8281a5f2d4344cddc895b8c9fcc10847f3243` (Paris venue and NFL yardage coverage, PR #139). This account work did not trigger that release or change the original service configuration. The main update was merged into the account draft to preserve it.

A fresh authenticated live account-switch/save walkthrough was not repeated: the earlier synthetic test credentials were temporary and were not retained in this session. Existing invitation and owner credentials were not rotated to work around that limitation. Live authenticated checks from the original account/persistence deployment are recorded separately in `account-test-validation-2026-10-25.md`. iPhone/Android visual testing remains outstanding.

## Limits and next work

This isolates records within the application; it does not encrypt browser storage against someone who controls the device. Existing unscoped customer beta data is not automatically assigned to any account. Existing owner history stays intact, and customer cloud copies can be loaded explicitly.

Password recovery and email verification are still pending, followed by scalable storage, backup recovery checks and subscription entitlements. No paid access, main-branch merge or original-service deployment is included in this change.
