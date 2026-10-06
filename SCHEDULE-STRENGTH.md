# Schedule strength in game predictions

Game predictions automatically correct scoring averages for past opponents when both selected teams have complete scoring coverage for their schedules. Rankings and player props remain unchanged. The result note displays baseline and adjusted scores with the same manual point adjustments, or explains why baseline scores were retained.

Only completed season games strictly before the selected kickoff are used. NFL data excludes non-regular-season games. Each opponent must belong to the model's verified 32-team NFL or 138-team FBS pool, have complete scoring data and at least two completed games. Missing or outside-pool opponents—including unmeasured FCS opponents—prevent adjustment for the whole matchup rather than silently imputing a rating. This can limit college coverage.

For each historical game, remove that game's score from the opponent's totals. Smooth the remaining opponent points-for and points-against averages using four league-average pseudo-games. Offensive correction is league scoring average minus average opponent scoring allowed; defensive correction is league scoring average minus average opponent scoring. Average each correction across the selected team's games, multiply by 0.5, and cap each at +/-6 points. Apply the existing team sample smoothing before combining offense and opposing defense into predicted scores.

This is a bounded, one-pass heuristic, not an iterative rating, fitted model or calibrated probability. The constants are assumptions. It does not claim demonstrated predictive improvement. Future calibration/backtesting is still required. Team-score injury, venue and weather adjustments remain unfinished.

Validation: 33 Node tests passed, including schedule correction direction, head-to-head exclusion, neutral schedules, bounds, missing coverage fallback, and pre-kickoff history/deduplication. JavaScript syntax and whitespace checks passed. Browser execution and live provider coverage were not verified in this change.
