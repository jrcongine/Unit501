# UNIT501 — October 26 work queue

Owner direction: continue autonomously, keep updates short. Saved-pick tracking
and Big 12 are no longer priorities; do not build either. Preserve existing
features unless removal is requested.

## Verified

- PR #145 merged as 28db016. Authenticated production college pulse returned
  the schedule-adjusted index and all 138 FBS teams on October 26.
- Direct Railway CLI login works. The connector reconnect flow still failed.
- Main baseline: all 471 Node tests passed locally.

## Current batch: NBA team estimates

Experimental score, home spread and total from existing pregame scoring history.
Each score averages a team's points scored and the opponent's points allowed.
Uses Last 5, Last 10, Season or away/home venue samples. Minimum three games
on each side; fewer than ten is labeled a small sample. This is an explicit
untuned baseline, not a calibrated betting model or a probability estimate.
No additional upstream requests, inferred lineups or football formula changes.

Live-input check: today's NBA slate returned nine games from the ESPN fallback.
Washington–Charlotte history returned three completed games per side. The local
candidate produced an estimate using that context and labeled the small sample.
This is an integration check, not predictive accuracy validation.

## Remaining

1. NBA player minutes, usage, availability and props: establish reliable player
   histories and identity matching before estimates; do not invent missing data.
2. NFL: live verification of starter evidence, expanded roles and injury effects.
   Existing manual 125/150/200% workload controls are already in main.
3. NBA first-half 20-point alerts: reliable closed-app push needs persistent
   subscriptions and a server scheduler. Current main watch is visible-page only.
4. Mobile/desktop cleanup, data freshness and broken-state handling.
5. Accounts: preserve separate draft #138. Finish live account-switch checks,
   recovery, persistent storage/backup and subscription verification before launch.
6. College basketball remains a later extension, not implemented NBA parity.

No new Big 12, saved-pick tracking or retrospective user forecast reconstruction.
Older open PRs may already be incorporated or superseded; do not merge blindly.
