# CUSA injury coverage follow-up — October 20, 2026

The requested automatic CUSA importer remains incomplete. This change fixes the fallback experience; it does not enable CUSA automatic injury scoring.

## Findings

The college adapter imports SEC, ACC and Big Ten reports from HD Intelligence. CUSA's official page instead embeds Faktor Sports. The published embedded URL returned an empty HTML body during this investigation, so neither report structure nor current player statuses could be verified. No parser or guessed injury data has been added.

Official report page: https://conferenceusa.com/sports/2025/8/23/FB_0823254134.aspx
2026 conference alignment: https://admin.conferenceusa.com/news/2026/4/29/fb-cusa-releases-revised-2026-football-schedule.aspx

## Changes

- Recognize 2026 CUSA teams only after the requested matchup is verified.
- Explain that automatic CUSA availability import is not connected and provide the official report link.
- Surface the source-specific reason in the injury scoring details.
- Replace indefinite Pending fields with Unavailable and explain how to use existing manual adjustments.
- Keep missing reports unknown, retain existing scoring gates, and add no paid-provider calls.

## Remaining work

Obtain a readable current official report; verify its publication timestamp, matchup and player schema; implement and fixture-test an importer. Validate QB identity, replacement and history through the existing quarterback-impact module. Do not assign a blanket QB deduction or treat absence from a missing report as healthy.

This follow-up is based on draft PR #124 and is not deployed.

See `fbs-injury-coverage-status.md` for the subsequent all-FBS mapping and additional conference adapters.
