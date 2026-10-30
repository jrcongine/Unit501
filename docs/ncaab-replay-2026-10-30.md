# College basketball replay — October 30, 2026

Run `node scripts/ncaab-scoring-diagnostics.js` to reproduce this selected-team report. The general CLI `node ncaab-backtest.js events.json [season|recent5|recent10]` accepts public source event arrays.

## Limits

Selected-team college basketball replay of ESPN 2024–25 season-type-2 events. Ten purposively selected teams, not a representative league sample. Only matchups where BOTH teams had their schedules collected are graded. Individual event season and duplicate agreement were checked; current-year wrapper discrepancies are retained in provenance. This is a source-returned schedule sample, not independent certification of complete historical coverage. Existing pre-tipoff history and missing-score guards apply. No odds, betting returns, injuries, player props, simulation calibration or future confidence validation. No weights or defaults changed.

## Results

| Setting | Evaluated games | Team score MAE | Total MAE | Total bias | Margin MAE |
|---|---:|---:|---:|---:|---:|
| season | 26 | 10.023 | 18.023 | -4.569 | 9.854 |
| recent5 | 26 | 9.835 | 16.869 | -2.177 | 10.492 |
| recent10 | 26 | 9.821 | 17.265 | -3.619 | 10.004 |

The sample is too narrow to establish all-league accuracy or to choose a new production default. Errors are reported in points. These results validate that the existing baseline can be replayed with explicit time and integrity guards; they do not validate its simulation probabilities.

The archive includes schedules returned for Alabama, Arkansas, Auburn, Duke, Florida, Kansas, Kentucky, Tennessee, Texas Tech and UConn. Source URLs, retrieval time and the response-wrapper year discrepancy are retained. Only games between those collected teams are included in the displayed metrics.
