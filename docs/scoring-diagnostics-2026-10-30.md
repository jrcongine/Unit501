# NFL scoring diagnostics — October 30, 2026

Run `node scripts/scoring-diagnostics.js` to reproduce the detailed report.

## Scope

Archived NFL 2024/2025 regular-season results. Production baseline; each forecast uses games at least 24 hours earlier. Exclude first 30 eligible forecasts and same-kickoff peers separately per season. Team segments overlap; do not add their game counts. Favorites are MODEL favorites, not sportsbook favorites. Evening means Central kickoff hour >=18, not verified prime-time broadcast. No contemporaneous injuries, weather, odds, profit or calibrated-confidence validation. These seasons have already informed earlier audits, so this is descriptive replay, not a new untouched holdout. No live weights changed.

## Results

| Season | Games | Team score MAE | Total MAE | Total bias | Margin MAE | Model favorite correct |
|---|---:|---:|---:|---:|---:|---:|
| 2024 | 206 | 7.445 | 10.493 | -1.863 | 10.168 | 69.4% |
| 2025 | 210 | 7.513 | 10.644 | +0.637 | 10.513 | 62.4% |

Positive total bias means the model ran high. The direction changes between seasons; this does not support a blanket downward total adjustment. Winner accuracy is retrospective model-favorite accuracy, not a calibrated probability for a new game or an against-the-spread result.

The model produced no 21-point-margin forecasts in these samples; 38 and 39 actual games ended with margins of at least 21. Of those, 23 and 19 came from forecasts below seven points. These counts compare mean score forecasts with individual outcomes: they do not establish that simulation tails are too narrow or justify multiplying all margins. Model-favorite margin bias was −0.054 and +0.879 points respectively, so a blanket margin expansion is also unsupported.

The script reports per-team errors, model home/away-favorite groups, pick’em forecasts and Central evening/earlier kickoff groups. Team groups overlap; their counts must not be added. Evening kickoffs are not verified prime-time broadcasts. No contextual weight was fitted or deployed. College football and basketball require their own evidence.

## Data safeguards

Duplicate football game observations must agree on league, season, stage, kickoff, status, teams, scores and venue. Contradictions now stop rankings/replay; supplemental opponent contradictions cannot receive verified status. Identical copies are deduplicated. This does not certify an upstream schedule contains every game.
