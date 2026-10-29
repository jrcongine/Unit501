# October 29: stat integrity batch

## Changes

- Football projections now withhold any market with unresolved historical team-game gaps. Missing older games can be omitted zeros just as easily as missing recent games. Incomplete workload no longer feeds a workload/efficiency estimate; complete yardage can still use its recorded-yardage fallback.
- Added a narrowly scoped reviewed Jonnu Smith correction for seven 2026 Packers games. It requires a unique exact player/team match and all seven dates, opponents and final scores, and rejects conflicting existing statistics. It updates the actual history before averages, medians, projections and backtests consume it. It does not invent targets or unrelated markets.
- Official sources: https://www.packers.com/team/players-roster/jonnu-smith/logs/ and https://www.packers.com/team/players-roster/jonnu-smith/ (reviewed October 29). The season total records seven appearances, six receptions and 94 yards. Four receiving entries account for all receptions and yards; the other three appearances have zero receptions/yards. Seven-game Over 3.5 yards: 4 hits, 3 misses (57.1%); Over 1 reception: 2 hits, 3 misses, 2 pushes. This review is not an ongoing participation feed and must not be extended to other games or players without evidence.
- NBA and college basketball now reconcile player appearances/DNPs against fetched historical team games. Missing player rows remain unknown, including possible traded-player history. Incomplete market values withhold estimates instead of silently reducing the sample. Unknown/rounded-zero minutes are quarantined rather than assumed DNP.
- College basketball rejects ambiguous participation, duplicate IDs and incomplete box-score coverage. NBA/college Data Health reports partial player-history coverage.
- NBA Above/Below sorting now uses exact hit fractions, with sample size as a tiebreaker, and displays percentages beside counts. College basketball now displays the actual withholding reason.
- Updated nine pre-existing failing integration assertions to match the already-deployed 3-point home-field default, recorded/total coverage display, and detailed report text moved into Report details. No score-model weights changed in this batch.

## Verification

- Unchanged baseline b268375: 644 tests, 635 passing, 9 failing.
- Final batch: 653 tests, 653 passing, no skipped tests (`npm test`).
- Regression cases include real zero, DNP, missing game, missing market, wrong scope/opponent/final score, conflicting correction, duplicate identity, percentage sorting and incomplete-history projections.
- Existing suites also cover team-ID/season matching, retries/quota guards, odds matching/staleness/history, pregame checks, archived forecasts, calibration, NBA/college engines, consensus and KISS client flows.
- Railway's two main services reported successful existing deployments before changes. Deployment verification for this commit is recorded in the delivery report.

## Remaining work / limits

- Issue #200 remains open: general NFL/college participation ingestion and automatic zero-game reconciliation are not implemented. The Smith review is deliberately limited. Missing games may now cause more projections to be withheld until reliable participation is available.
- Authenticated production data-health/feed checks could not be performed: the app requires owner Basic authentication and the Railway OAuth connection exposes variable names only. The 7,500 budget and quota-header guard are present and tested; the current provider entitlement is not newly verified by this session.
- FanDuel availability for every supported sport/market, current injuries/trades/lineups, and automatic opening/prop-history capacity need authenticated live verification. Collection limits were not raised.
- New historical performance results, learned confidence improvements, broader power-rating/close-game/upset changes and systematic regrading of earlier saved predictions are not claimed. Existing archives and saved data are preserved.
- NBA/college tests pass, but live seasonal validation remains necessary; beta labels remain unchanged.
- No browser visual QA or authenticated live Smith smoke test was performed. The reviewed correction fails closed if provider identity/schedule details do not match.
