# NBA injury wiring and independently evaluated win calibration

Continuation from `fa9ad4103f28dce373b36e13f6ab76d3194e0177`. This closes specific NBA integration and calibration gaps, not the entire cross-sport work order.

## Injury integration repaired

The NBA team-history adapters return ISO timestamps; the shared injury model required numeric timestamps. Fresh production NBA contexts were therefore withheld despite passing older synthetic numeric fixtures. The model now accepts explicit timezone-bearing ISO timestamps as well as numbers, while retaining expiry/future checks.

NBA player history uses ESPN game IDs, while the primary scoring context uses API-NBA IDs. Direct ID equality could never identify the same games across these sources. Player history now carries the verified historical opponent, exact tipoff, venue and final score. The shared model requires a unique one-to-one agreement across all those facts before looking up the ESPN participation record. Missing, duplicate, conflicting or unsupported mappings remain withheld. College keeps its same-provider ID matching. This changes identity reconciliation, not injury weights or inferred playing time.

Regression tests reproduce the old failure, verify both actual timestamp/ID contracts through the NBA client, preserve stale-evidence withdrawal, and reject wrong opponent/time/venue/score and missing participation. Complete participation, three joint absent/three joint played games, scoring-average reconciliation and the existing quality guard still apply. Early-season samples can legitimately remain insufficient.

## Independent probability evaluation

The existing candidate coefficients were frozen before evaluating the newly collected 2025–26 season: intercept `0.29273998511634036`, slope `1.6006665404787768`. They were trained on 400 pre-January-2025 games. They were not refit or selected using the new season's outcomes.

Collection: 30 public ESPN team schedules, exactly 82 completed regular-season games per team, 1,230 unique games, each reconciled from both teams' schedules. Event-level season identity is checked; ESPN's top-level wrapper can report the current season despite historical events. NBA Cup championship/non-final rows are explicitly excluded. Contradictory, duplicate or incomplete schedules fail collection.

Replay uses the production Season scoring model and 10,000 deterministic simulations per game, with only pre-tipoff histories. The comparison conditions on non-tied simulations; it is not an overtime model. Of 1,230 games, 1,151 have eligible simulations. Lower values are better:

| 2025–26 independent season | Existing probability | Frozen calibrated probability |
|---|---:|---:|
| Brier score | 0.21745239 | 0.20749306 |
| Log-loss | 0.62601192 | 0.60362907 |

The paired UTC-date-block bootstrap interval for candidate-minus-baseline Brier error is [-0.01414082, -0.00561962] (2,000 replicates). Performance is not uniformly better: December worsens; October has only one eligible game. Historical reconstruction is not prospective prediction tracking or betting-profit validation. This archive contains no historical odds, injuries or itinerary data.

## Narrow production decision

Based on the independent season's lower aggregate Brier and log-loss and the paired interval below zero, the NBA UI adds a separate **Historically calibrated win estimate** for the regular-season **Season** baseline only. Both teams must have at least five simulation sample games. It is withheld for applied injury adjustments, unsupported model versions/scopes, playoffs, missing injury-adjustment metadata, invalid probabilities and all-tied simulations. The original simulation, score, spreads/totals and upset gate remain unchanged. Extreme outputs display `<0.1%` or `>99.9%`, never certainty.

This is not a general confidence rating, FanDuel price, calibrated prop/cover probability, or guarantee. NFL/CFB/CBB and injury-adjusted NBA probabilities have not been validated by this dataset. Broader strength/rest/travel/replacement coefficients remain unfinished.

Reproduction:
- `node scripts/collect-nba-audit.js 2025 OUTPUT.json` (requires a new destination; never overwrites an archive).
- `node scripts/nba-independent-calibration-audit.js` reproduces the committed evaluation JSON.

## Deployed-asset verification without owner interaction

On Railway startup, `runtime-verification.js` uses the server's existing private credential internally for authenticated loopback GETs of the basketball pages/scripts and passive saved Data Health. It compares served assets with deployed file hashes and logs only bounded pass/fail and whitelisted feed-status fields. It never logs credentials or raw API payloads, follows redirects, contacts paid providers, changes authentication, or writes production data. A missing password skips verification; errors do not stop the app.

This verifies that the deployed server serves the expected protected assets and can read saved feed diagnostics. It does not prove live paid-provider parity, visual browser layout, or current player statuses. Those limits remain explicit.

## Validation completed before publication

- Full suite: **882 passed**, zero failures/skips/cancellations; `git diff --check` passed.
- Actual local server with an ephemeral private test password: all five protected assets matched their deployed-file hashes and passive Data Health authenticated successfully. No provider keys were configured for this check; no paid requests were made.
- Client regression verifies the NBA score changes with ISO context timestamps and cross-provider game IDs, then restores baseline and displays the scoped calibrated estimate when injury evidence expires.
- Production deployment and runtime verification results are reported after release; local tests alone do not establish production success.
