# Movie night audit — October 30, 2026

Baseline reviewed: 325e178776501cf194d9c94449f2a770d90507bc. Both Railway Unit501 services track main; the service in humble-amazement has the provider configuration and persistent line history. The other service has no configured provider variables. No service configuration was changed.

## Verified changes

- NFL/CFB and NBA use the same upset-review gate: the spread underdog must lead by at least 2 unrounded projected points and have at least 55% raw simulated wins. These are conservative review thresholds, not backtested probability guarantees. Smaller leads remain model leans. Missing simulation support cannot trigger an alert. Raw ties are not reassigned to either team.
- Football all-tied/all-push samples now return null for undefined conditional probabilities instead of NaN. Raw tie and push frequencies remain available; overtime is not invented.
- College official injury reports expose per-source diagnostics distinguishing fetch/parse failure, no exact matchup, ambiguous latest reports, and failed game verification. Automatic scoring retains the warning and includes the source explanation. The continuation below also expands verified conference coverage.

## Injury trace and remaining gaps

- Football: availability.js -> official-injuries.js / college-availability.js -> public/auto-injury.js -> public/app.js options -> public/team-model.js project -> simulate. Matched reports require fresh roster/role evidence. Existing tests verify injury score changes, replacement scenarios, identity conflicts, stale reports and partial coverage.
- College official coverage now includes Big 12, SEC, ACC, Big Ten, American and MAC. Official American and MAC pages embed the existing HD Intelligence publisher; real Tulane/Charlotte and Kent State/Sacramento State snapshots pass exact-matchup tests. Third-party college notes remain display-only. Other conference formats remain unsupported.
- NBA official reports and CBB ESPN availability reports gate player estimates, including withholding confirmed Out players. NBA teammate-minute logic exists. Neither basketball team score model applies injuries or replacement-player effects to the team simulation. This is unfinished implementation, not a repaired feature.
- Current starters, depth charts and individual live statuses were not independently verified in this run. Do not interpret passing fixtures as confirmation of current availability.

## Props/history trace

- Football fanduel-props.js and basketball nba-odds.js use prop-quotes.js for paired FanDuel main lines, timestamp validation, duplicate handling and market rejection diagnostics. Existing fixes for aliases, identical duplicates, neutral same-origin fallback and touchdown history were already present and were not reimplemented.
- Shared player-history tests exercise genuine zeros, DNP/missing separation, pushes, incomplete-sample withholding and identity collisions; browser-flow tests exercise line display and calculations. All passed in the final suite.
- Full coverage of FanDuel's live website cannot be inferred from the aggregator. Actual provider response versus FanDuel comparison remains unverified here: the deployed app requires Basic authentication; Railway OAuth exposes variable names only, and the local environment has neither app credentials nor provider keys. No credentials were reset or access protections removed.

## Prediction-factor audit

- Football opponent-strength corrections and home-field adjustments modify projected scores before simulation. Existing integration tests cover these paths, injury/lineup adjustments and weather. This establishes wiring, not improved predictive accuracy.
- Rest and travel in the football client are descriptive, not automatic score adjustments. No standalone power-rating input is wired into the basketball baseline models. NBA/CBB team models average team scoring and opponent points allowed, with empirical residual simulations; they do not implement the requested full strength/rest/travel/injury model.
- Basketball ties are kept separately and are not final-game draw probabilities; overtime is not modeled. Adding defensible factor weights and replacement effects requires model implementation and held-out validation; none were invented in this patch.

## Validation

- Baseline: 813 tests passed.
- Initial audit patch: 816 tests passed, zero failures, skipped or cancelled tests (`npm test`). Includes NFL/CFB, NBA and CBB provider, history, model and client tests.
- Added regression cases: tiny away/home underdog leads; insufficient raw win support; missing/invalid probability data; legitimate larger leads; all-tied football sample; college source diagnostics.
- `git diff --check` passed.
- Initial configured-production `/api/health` returned HTTP 200 with ok=true, private=true and liveData=true. This establishes server response and API-key presence, not upstream provider health or authenticated feature success.

Outstanding work: broader verified college injury coverage; basketball team injury/replacement modeling; calibrated strength/rest/travel factors; authenticated live prop/status verification and held-out accuracy evaluation. The work order is partially completed, not fully resolved.

## Autonomous continuation

Additional fixes completed without owner computer access:

- College basketball duplicate injury sections no longer silently become empty lists. Reported absences/statuses remain visible, while duplicate, missing, malformed and unnamed-row coverage is explicitly unverified.
- NBA/CBB player projections reject contradictory played/DNP records and invalid DNP timestamps. Verified zero-stat appearances continue to count, and genuine DNPs remain outside the hit-rate denominator.
- Full suite: 819 passed, zero failures. The existing synthetic DNP fixture was updated to include the timestamp supplied by the actual adapters. No live provider verification is implied.

NBA/CBB player tables now explicitly label unconfirmed availability alongside each estimate. Conditional statuses explain that the estimate assumes participation, and a listed Available status does not confirm starting role or minutes. This disclosure preserves history-only estimates without presenting missing reports as healthy. Full suite: 820 passed, zero failures.


## Final continuation — October 31

- Added American and MAC official sources, with narrow aliases for observed school abbreviations. Official pages: https://theamerican.org/sports/2026/8/6/football_player_availability.aspx and https://getsomemaction.com/sports/2026/7/28/FB_0728265050.aspx.aspx . Stored real report snapshots; synthetic provider IDs/workloads in tests are explicitly labeled. Confirmed Out records block player estimates and affect football scoring only when independently matched workload is present. Stale reports remain withheld.
- Automatic prep can rerun after refreshed data invalidates a simulation, including lineup updates. Manual input edits still require deliberate rerunning.
- Data-health tracking now includes the football player-lines alias and reports rejected/missing prop markets and unresolved official players as partial coverage.
- NFL parser rejects unexpected table rows instead of silently dropping them. Duplicate team or roster identities withhold affected projections/scoring.
- Final suite: **828 tests passed, zero failures, skipped or cancelled**; `git diff --check` passed. Tests span NFL, CFB, NBA and CBB; live provider coverage is not inferred from fixtures.

### Independent public-source verification

At approximately 02:12 UTC October 31, the official NFL Week 8 page parsed 28 team sections. The official NBA October 30 10 PM PDF parsed with a matching header and 17 games. Public CBB November 2 schedule returned 182 games; the sampled Grambling/Northern Illinois injury adapter correctly returned unavailable reports, not invented healthy rosters. All six configured college conference feeds returned public report payloads. These checks verify source/parser operation, not every current player or authenticated production feature.

### Accuracy work retained separately

Research branch `audit/nba-home-rest-2026-10-30` (commit `7a12775892a9437ac10d82eb05e2555016ee7a1b`) contains a reproducible NBA archive evaluation and tests. Training used 432 games, chronological validation 750. Adding home/rest reduced margin MAE by only 0.026 points (bootstrap interval crossed zero) and reduced winner accuracy. Weights were therefore not deployed. The archive was previously inspected, so this is not an untouched final holdout. Historical odds, injuries and travel are absent.

### Remaining blockers

Authenticated production routes and paid provider payloads remain inaccessible with the available credentials; no access protections were bypassed. Live FanDuel parity, full current starters/depth charts and paid player identity checks remain unverified. Basketball team injury/replacement effects and calibrated rest/travel/strength models remain unfinished; adding arbitrary weights would not establish accuracy. Additional college conference source formats and complete CBB injury coverage still need work. Production health only verifies server operation and configured-key presence.

## Basketball continuation — October 31

- Rechecked GitHub main and the successful Railway deployment at `85a873d` before starting; no prior changes were repeated.
- NBA parser now preserves named rows from conflicting or unrecognized reports. Unknown statuses are explicitly `Unverified`; conflicting statuses remain visible, and the affected report cannot verify a player projection. The client displays these rows alongside the coverage warning.
- CBB injury reports refresh at their fifteen-minute expiry, retry failures after one minute, defer refreshes while hidden, and stop at tipoff. Previous rows stay visible with an expired/failed warning. Repeated requests and late responses cannot replace a newer game selection. Fresh reports immediately redraw player projections.
- Extended the existing NBA teammate-absence comparison to CBB with the CBB report timestamp, team names and fifteen-minute limit. Requires a current confirmed Out teammate, unique identities, explicit historical DNP records, and at least two matched appearances in each comparison group. Missing rows are never inferred to be DNPs.
- CBB offers an optional minutes scenario derived from that observed comparison, capped at 40 minutes. It changes the player's projections across markets, preserves actual Above/Below/Equal counts, and removes itself when refreshed evidence no longer supports it. This is a manual historical scenario, not an automatic replacement forecast or confirmed starting role.
- `npm test`: **833 passed, zero failures/skips/cancellations**. Added parser, browser-flow, refresh/race, cross-market scenario, and evidence-expiry regressions. `git diff --check` passed.

Basketball team-score injury adjustments remain unfinished. Existing team histories contain final scores, while the player-history adapter covers only the recent ten games. A reliable team injury effect cannot be established by subtracting a missing player's scoring average or adding teammate usage increases: replacements score, overlapping absences confound comparisons, and the team baseline may already include the absence. No unvalidated team-point penalties were added. Live authenticated verification remains blocked by unavailable app/provider credentials; these changes required no owner computer access.
