# Movie night audit — October 30, 2026

Baseline reviewed: 325e178776501cf194d9c94449f2a770d90507bc. Both Railway Unit501 services track main; the service in humble-amazement has the provider configuration and persistent line history. The other service has no configured provider variables. No service configuration was changed.

## Verified changes

- NFL/CFB and NBA use the same upset-review gate: the spread underdog must lead by at least 2 unrounded projected points and have at least 55% raw simulated wins. These are conservative review thresholds, not backtested probability guarantees. Smaller leads remain model leans. Missing simulation support cannot trigger an alert. Raw ties are not reassigned to either team.
- Football all-tied/all-push samples now return null for undefined conditional probabilities instead of NaN. Raw tie and push frequencies remain available; overtime is not invented.
- College official injury reports expose per-source diagnostics distinguishing fetch/parse failure, no exact matchup, ambiguous latest reports, and failed game verification. Automatic scoring retains the warning and includes the source explanation. This improves diagnosis; it does not add conference coverage.

## Injury trace and remaining gaps

- Football: availability.js -> official-injuries.js / college-availability.js -> public/auto-injury.js -> public/app.js options -> public/team-model.js project -> simulate. Matched reports require fresh roster/role evidence. Existing tests verify injury score changes, replacement scenarios, identity conflicts, stale reports and partial coverage.
- College official coverage is limited to Big 12, SEC, ACC and Big Ten. Tulane/Charlotte and Kent State/Sacramento State are outside that implemented source set. Third-party college notes are explicitly display-only and cannot establish verified absences. No complete official feed for those matchups was verified in this run.
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
- Final code: 816 tests passed, zero failures, skipped or cancelled tests (`npm test`). Includes NFL/CFB, NBA and CBB provider, history, model and client tests.
- Added regression cases: tiny away/home underdog leads; insufficient raw win support; missing/invalid probability data; legitimate larger leads; all-tied football sample; college source diagnostics.
- `git diff --check` passed.
- Initial configured-production `/api/health` returned HTTP 200 with ok=true, private=true and liveData=true. This establishes server response and API-key presence, not upstream provider health or authenticated feature success.

Outstanding work: broader verified college injury coverage; basketball team injury/replacement modeling; calibrated strength/rest/travel factors; authenticated live prop/status verification and held-out accuracy evaluation. The work order is partially completed, not fully resolved.

## Autonomous continuation

Additional fixes completed without owner computer access:

- College basketball duplicate injury sections no longer silently become empty lists. Reported absences/statuses remain visible, while duplicate, missing, malformed and unnamed-row coverage is explicitly unverified.
- NBA/CBB player projections reject contradictory played/DNP records and invalid DNP timestamps. Verified zero-stat appearances continue to count, and genuine DNPs remain outside the hit-rate denominator.
- Full suite: 819 passed, zero failures. The existing synthetic DNP fixture was updated to include the timestamp supplied by the actual adapters. No live provider verification is implied.
