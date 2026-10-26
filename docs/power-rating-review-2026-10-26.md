# Power rating review — October 26, 2026

The league Power Index is display-only (`league-pulse.js`). It never feeds the
football score model, player projections or NBA scoring. College schedule
strength changes the displayed FBS ordering only. The prediction engine instead
uses pre-kickoff scoring averages, four-game baseline shrinkage, a separate
opponent correction, venue and eligible injury/weather inputs. These are
separate calculations; the displayed index is not a win probability.

## Source conflict correction

Repeated standings rows previously needed only matching team name, game count
and point differential. A conflicting win/loss record with the same number of
games, or different points scored/allowed with the same differential, passed.
The board then depended on which row appeared first. Require the record and
both scoring totals to agree as well. Conflicts withhold the board. Identical
rows remain deduplicated. Tests exercise both row orders in NFL, FBS, NBA,
MLB and NHL.

## Historical scoring replay

Run `node scripts/rating-prior-audit.js`. Existing archived NFL regular-season
results, no network or paid requests. Each forecast uses results at least 24
hours earlier. The first 30 eligible predictions and same-kickoff peers are
excluded. Comparing two-, three- and four-game shrinkage assumptions:

| Season | Games | Prior games | Score MAE | Total MAE | Margin MAE |
|---|---:|---:|---:|---:|---:|
| 2024 | 206 | 2 | 7.521 | 10.708 | 10.271 |
| 2024 | 206 | 3 | 7.470 | 10.580 | 10.184 |
| 2024 | 206 | 4 (current) | 7.439 | 10.493 | 10.128 |
| 2025 | 210 | 2 | 7.549 | 10.775 | 10.521 |
| 2025 | 210 | 3 | 7.504 | 10.693 | 10.465 |
| 2025 | 210 | 4 (current) | 7.487 | 10.644 | 10.436 |

The current four-game setting has the lowest errors among these three choices
in both seasons. Retain it. This comparison is not validation of incorporating
the displayed Power Index. It contains no bookmaker lines, wagering returns,
injury or weather scenarios and does not establish college/NBA accuracy.

## Outstanding

Live 2026 national college source reconciliation remains unverified behind
private app access. Connecting the displayed index to forecasts would require
a pre-kickoff historical index and a held-out comparison against the existing
model, with protection against double-counting opponent adjustments. No such
integration or claim of predictive improvement is included in this fix.
