# November 1 road-trip repair

Baseline: main 99cf825, production service Unit501 in humble-amazement. Railway reported successful deployment 9ea4d4e3 and its authenticated loopback asset verification. Baseline regression suite: 911 passing tests.

## Changes

- NBA and CBB now retain history-backed player/stat rows when the sportsbook returns no quote or the quote request fails. Both use one catalog builder. Projections still require fresh, unambiguous and complete histories. No line, price, difference or above/below percentage is manufactured. A separately entered historical comparison threshold remains available.
- NBA exposes median, difference, and recent workload as table columns, matching the information visible in college basketball and football. Quote counts distinguish real betting lines from history-only rows.
- NBA injury calculations previously compared ESPN team IDs directly with API-NBA team IDs. Player-history responses now carry the selected provider's team mapping after the existing exact matchup verification. The injury model uses that mapping while retaining team names, report freshness, game fingerprints and participation checks. This repairs an accidental veto; it does not invent injury point values or loosen sample requirements.
- Last-opponent rendering handles missing results safely and rejects unverified participation for the matching game. Added the prop model, prop client and last-opponent script to authenticated startup asset verification.

## Reviewed existing work

The last-opponent column and prior-season football search were already committed. Basketball already defaults to CBB and automatically starts slate, War Room and league updates; these paths remain covered by regression tests. Football zero/DNP/missing-history and injury-to-simulation checks remain in the full suite.

## Limits that remain

- Basketball opponent results use the loaded recent history (up to 10 games). An opponent meeting outside that history remains unavailable. This is not a complete career head-to-head lookup.
- This change does not create missing FanDuel provider coverage. Previously recorded production feed health included NBA props unavailable and stale basketball injury/history observations. Saved observations are not a fresh end-to-end provider test.
- Team injury adjustments still require sufficient verified participation/scoring evidence. Teammate minutes scenarios remain explicitly manual, not confirmed replacement workloads. Basketball models remain experimental.
- Railway OAuth exposes configuration names, not the private application password. Direct authenticated live-feed and browser visual verification were not performed in this session; deployment startup performs authenticated asset checks using the service's own credentials.
