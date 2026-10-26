# Power Index prediction experiment — October 26, 2026

Decision: do not enable this candidate. The displayed Power Index remains
independent of predictions. This result rejects one specific incremental
mapping, not every possible ratings model.

Rebuilt the production NFL display formula before each historical game using
only completed results at least 24 hours earlier. Added 0.1 margin points per
home-minus-away index point, bounded to +/-6, by transferring half the change
between team scores. This is a fixed experimental assumption; no tuning was
performed. Keep the existing score model, including opponent corrections, as
the baseline. The experiment tests whether the index adds useful information
on top of that model.

Exclude the first 30 eligible forecasts and same-kickoff peers in each season.
Both models use the same remaining games. Data: existing 2024/2025 NFL archive.

| Season | Games | Baseline score MAE | Candidate score MAE | Baseline margin MAE | Candidate margin MAE |
|---|---:|---:|---:|---:|---:|
| 2024 | 206 | 7.439 | 7.492 | 10.128 | 10.404 |
| 2025 | 210 | 7.487 | 7.554 | 10.436 | 10.614 |

Total error stays unchanged because the adjustment preserves the score total.
Both seasons show worse score and margin errors. The candidate projects more
blowouts, but that does not offset the overall error increase. Do not infer a
betting advantage from more assertive forecasts.

Reproduce with `node scripts/power-index-audit.js`. Machine-readable output:
`docs/power-index-replay-2026-10-26.json`. Tests check future-result exclusion,
row-order invariance, duplicate-game rejection, orientation and score-total
conservation. The research script is not loaded by server or browser code.

No bookmaker lines, wagering returns, injuries or weather were tested. These
NFL results do not establish college or NBA performance. A different ratings
integration requires its own pregame reconstruction and later-period test;
current standings cannot be substituted into past forecasts.
