# NBA historical replay — October 30, 2026

Run `node scripts/nba-scoring-diagnostics.js` offline to reproduce the report.

## Source and limits

Descriptive NBA 2024–25 regular-season replay using public ESPN team schedules retrieved 2026-10-30T18:59:25.539Z. Source wrapper season incorrectly described the current season; individual event season years, duplicate agreement, 30 team identities and 82 completed regular-season games per team were checked. Five non-final schedule entries and the source-labeled NBA Cup Championship were excluded. Uses the existing production NBA backtest and its pre-tipoff history safeguards. Settings are compared on this one season; this is not an untouched validation set for choosing a new default. No historical odds, injuries, player props, returns, simulation calibration or future confidence validation. Model favorites are not sportsbook favorites; per-team groups overlap.

## Results

| History setting | Evaluated | Skipped | Team score MAE | Total MAE | Margin MAE | Winner decisions | Model winner accuracy |
|---|---:|---:|---:|---:|---:|---:|---:|
| recent5 | 1182 | 48 | 9.714 | 15.326 | 11.646 | 1173 | 63.4% |
| recent10 | 1182 | 48 | 9.510 | 15.000 | 11.450 | 1164 | 65.6% |
| season | 1182 | 48 | 9.481 | 15.021 | 11.455 | 1173 | 65.3% |

MAE is average absolute error in points. Skipped games did not meet the production model’s historical eligibility rules. Tied model projections have no winner decision. These are retrospective accuracy measurements, not confidence ratings for current picks.

No setting or score weight was changed. One season inspected across several alternatives cannot establish that a new setting generalizes. The script includes team and model-favorite-side error segments; team samples overlap. The archived data retains source URLs, retrieval time, original wrapper-season discrepancies, event counts and exclusions.

This checks the production scoring baseline through the existing replay function. NBA simulations, injury/role adjustments, player markets and college basketball still require separate validation.
