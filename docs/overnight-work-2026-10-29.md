# October 29 overnight work — verified batch

Starting main: `69c55f58902003a0de1b84ef08e2efe9aff40e35`.
Reviewed recent commits, October 26 work queue, NBA readiness/scoring validation,
production configuration and deployment logs before editing. This work order
supersedes the old queue's instruction not to build Big 12 tracking, but that
feature is not implemented in this batch.

## Changes tested in this batch

1. Shared line history: cached, rejected or missing quotes no longer push the
   next background check indefinitely into the future. Only a new source
   observation advances the last-success time. Background attempts retain their
   normal retry interval and credit reservation. Regression reproduces repeated
   reads at five-minute intervals, restart persistence and the eventual move.
2. College basketball: require integer sample counts of at least three and
   finite nonnegative simulation scores/history. Invalid scores previously
   could fall through comparisons and appear as 100% ties. Invalid random
   callbacks are rejected before simulation. No scoring coefficients changed.
3. War Room: convert verified Covers Eastern kickoff labels using daylight or
   standard time and remove started games, including from cached responses.
   Ambiguous DST hours remain unknown. No inferred replacement picks.

Validation: 622/622 Node tests passed, zero skipped. Line-history and college
basketball regression cases failed against their original implementations.
New War Room tests cover kickoff expiration without a new source request,
daylight/standard time, unknown times and the repeated DST hour.
`git diff --check` passed. Basketball beta labels remain.

## Live checks and existing work

- Railway production service `087dc2a0-0be8-4e8d-9f19-57350530b860` in project
  `89cc5e71-c560-4655-ba8f-249576eb0d8d` runs this repository's main branch.
  Starting deployment `3ee32df2-b62b-4c73-9d7e-a8d05a21fac7` was SUCCESS.
  Startup log confirmed persistent line-history storage, a 240-credit daily
  background budget and zero active watches at startup. Watches begin when a
  matchup is loaded; this does not collect every game's true opening line.
- Public health endpoint returned HTTP 200. Authenticated application checks
  are blocked: Railway OAuth exposes variable names, not credential values.
  API_SPORTS_KEY and ODDS_API_KEY are configured; account entitlements are not
  thereby verified. Local football cap is already 7,500 with provider-header
  guards and regression coverage; actual subscribed daily limit remains open.
- Public War Room smoke check at 2026-10-29T08:40Z returned 126 selections:
  NFL 34, college football 74, NBA 9, NHL 9, MLB 0. All returned rows passed
  structural attribution checks. Some source dates/authors remain unverified;
  this count does not certify all selections as current, distinct or consensus.
- Prior commits already address college prop loading races, college basketball
  moneylines/history, all consensus groups, and unadjusted ranking labels.
  Those changes were preserved, not rebuilt.
- Existing NBA research reports show season averages outperforming last-five
  averages on the seasons used for selection. That is not an independent
  accuracy test. No new historical backtest or accuracy gain is claimed here.

## Remaining / partially complete

- Priority 1: live 7,500 entitlement; all-sport FanDuel coverage; pregame roster,
  trade/depth freshness; full opening-line coverage. Roster sweeps are opt-in
  and are not enabled in the inspected production variables.
- Priority 2: validate schedule-adjusted power, Kennesaw diagnosis, rest/travel/
  matchup effects, upset calibration and score-margin bias on held-out games.
  Clarifying a ranking label does not fix model accuracy.
- Priority 3: basketball parity, verified lineup/replacement workloads and
  independent team/player backtests remain release gates.
- Priority 4: broader consensus identity matching, undated-source verification,
  college basketball feed support and automatic Big 12 saving/grading remain.
- Priority 5: no cosmetic changes in this batch; cross-sport visual QA remains.
- Priority 6: local regression validation complete; deployment/CI identifiers
  and final live health results will be reported after publication. Private
  page behavior and provider-backed endpoints remain unverified in production.
