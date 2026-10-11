# Scoring replay audit: October 10, 2026

Data snapshot cutoff: 2026-10-11T03:27:38.301000+00:00. Model: scoring-v2 compared with scoring-v1.

## Method

Read every Chicago-date college slate from August 1 through October 10 through the deployed API-Sports proxy. Refused provider errors, paginated responses and missing lists. Deduplicated game IDs and canonicalized verified school identities. The resulting pool contained all 138 distinct verified FBS programs. Only completed 2026 games before the snapshot cutoff with an FBS participant entered the replay.

Full Northern Colorado and Cal Poly schedules supported Wyoming/San Jose State opponent corrections; known head-to-head game IDs were verified in those schedules. This mirrors the selected-matchup supplemental context, not universal coverage of every FCS opponent.

Each replay snapshot, earlier-error variance fit and probability fit excludes kickoffs in the preceding 24 hours. Completion/publication timestamps are unavailable: the lag conservatively limits overlapping-game leakage and can omit results already known. It is not an exact historical publication archive. Same-kickoff games share snapshots and training boundaries.

## College results

225 eligible games; 219 skipped for warm-up, incomplete scoring or model coverage. After the first 30 eligible predictions, 195 later games compared fixed formulas:

| Metric | scoring-v2 | scoring-v1 |
| --- | ---: | ---: |
| Score MAE per team | 9.713 | 10.602 |
| Margin MAE | 14.162 | 14.722 |
| Total MAE | 12.711 | 14.037 |
| Total bias (projection minus actual) | +2.409 | +6.910 |

Among below-baseline offenses in the later subset: 130 team-games across 104 matchups, score MAE 8.688 vs 10.532; bias +2.254 vs +6.571. Group membership uses only pre-kickoff offensive scoring relative to the league environment. Two teams in one game are correlated observations.

For provider game 24623 (Wyoming at San Jose State), the lagged scoring-v2 replay was 18.570–22.041; provider final scores were 16–13. The previous formula replay was 24.602–26.338. These are reconstructed model outputs, not a record of what the old UI displayed or new betting recommendations.

## NFL cross-check

The same lagged method on complete schedules for all 32 teams yielded 33 eligible predictions. Current score MAE 7.136 vs previous 6.815. Below-baseline offenses had bias -1.561 points and MAE 8.068 vs 7.723. This NFL sample does not support uniformly lowering weak-offense projections; only three games remain after warm-up.

## Limits and validation

150 tests pass, including overlap-result invariance for both predictions and earlier-error fits, lagged pace snapshots, same-kickoff boundaries and future-result invariance. The scoring formula is unchanged. These are rolling in-season comparisons, not independent future validation. Historical injuries, weather, sportsbook closing lines and prop profitability are not measured. Residual college overprediction remains; no blanket correction was fitted from these diagnostics.
