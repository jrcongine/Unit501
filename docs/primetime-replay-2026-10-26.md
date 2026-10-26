# NFL game-time replay — October 26, 2026

The existing manual game-mode control can widen a forecast margin 10% or narrow
it 10%. We tested those exact score scenarios without switching them on in
production. The full results can be reproduced offline using
`node scripts/primetime-audit.js` and are saved in the accompanying JSON file.

## Method

Replay 2024 and 2025 NFL regular-season scores with the current scoring model.
Each prediction uses games at least 24 hours older than the kickoff. Exclude the
first 30 eligible predictions and all other games sharing that cutoff kickoff.
Compare the baseline and scenario on the same games. Evening means Thursday,
Sunday or Monday kickoffs at or after 6 p.m. Central; Sunday daytime means
Sunday kickoffs from 6 a.m. through 5:59 p.m. Central. This is a kickoff-time
proxy; it does not establish TV broadcast classification. Daylight saving is
handled using the America/Chicago time zone. Saturday games, holidays on other
days and international games outside those windows are not silently counted.

| Season | Window | Games | Baseline score MAE | Scenario score MAE | Baseline margin MAE | Scenario margin MAE |
|---|---|---:|---:|---:|---:|---:|
| 2024 | Evening, +10% margin | 39 | 7.535 | 7.545 | 9.378 | 9.480 |
| 2025 | Evening, +10% margin | 44 | 7.358 | 7.375 | 10.423 | 10.465 |
| 2024 | Sunday day, -10% margin | 138 | 7.473 | 7.480 | 10.468 | 10.463 |
| 2025 | Sunday day, -10% margin | 155 | 7.604 | 7.621 | 10.545 | 10.563 |

The +10% scenario worsened score and margin error in both evening samples.
The -10% scenario did not improve score error in either Sunday sample and had
mixed margin results. Neither is supported as an automatic change by this
replay. Continue to test rather than assert that time of day itself is the
cause. These are average errors, not prediction guarantees.

The existing archive has no historical sportsbook lines or player box scores.
A model-projected favorite is not necessarily the sportsbook favorite. This
replay cannot measure actual betting upsets, covers, profit, primetime player
prop performance, or establish whether NFL results apply to college and NBA.
No current lines or postgame data were used to construct past forecasts.
