# Unit 501 reliability pass — October 17, 2026 (Central Time)

## Implemented

- Automatic prep waits for the initial weather check and matching injury/role reports for both NFL and college games. QB evaluation receives the same team scoring context as the simulation. A failed simulation no longer reports success or permanently suppresses a later retry. Manual input edits pause automatic execution.
- Weather completion is tracked for indoor venues, failed lookups and outdoor forecasts. A late response for a previous matchup cannot replace the new matchup's weather state.
- Both game-line and player-prop feeds use safe, actionable authentication/quota diagnostics. Game-line keys are trimmed; duplicate markets and contradictory paired spreads are withheld rather than arbitrarily selected. Existing prop failure handling retains quotes with freshness checks.
- The existing six-hour background roster sweep now includes upcoming college games and their workload-based role reports. NFL retains depth and league ownership checks. Missing reports remain explicit; this does not invent roster transactions or confirm starters.
- Historical model checks now compare two-, three- and four-game rating priors using the same later games and pre-kickoff snapshots. Live smoothing remains four. Diagnostics count 21+ point outcomes and those following sub-seven-point forecasts.
- Simulation output includes raw 21+ point win frequencies for each team. This describes the existing score distribution; it does not add a fitted blowout model or calibrated blowout probability.
- The prop comparison introduction is shorter; projections, FanDuel lines, differences and source details remain available.
- Repaired the client test browser mock's DOM reparenting and CustomEvent support. The former caused an infinite loop / memory exhaustion while moving full injury reports into a details panel. Updated stale tests for home-field defaults, automatic injury coverage, explicit manual archive scenarios and college support.

## Smoothing replay

Run `node scripts/rating-prior-audit.js`. Uses the repository's NFL 2024–25 dataset. Each prediction sees only games with kickoffs at least 24 hours earlier. The first 30 eligible predictions and their simultaneous kickoff peers are excluded from comparison. Opponent correction keeps its existing conservative prior; only the team's rating prior varies.

| Season | Later games | Prior | Margin MAE | Total MAE | Total bias |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2024 | 206 | 2 | 10.271 | 10.708 | -1.854 |
| 2024 | 206 | 3 | 10.184 | 10.580 | -1.859 |
| 2024 | 206 | 4 | 10.128 | 10.493 | -1.863 |
| 2025 | 210 | 2 | 10.521 | 10.775 | +0.647 |
| 2025 | 210 | 3 | 10.465 | 10.693 | +0.641 |
| 2025 | 210 | 4 | 10.436 | 10.644 | +0.637 |

Lowering smoothing worsened both metrics in each season, so it was not promoted. Opposite signed total biases also do not justify a blanket downward scoring correction. This retrospective comparison has no historical injury/weather/closing-line data and establishes neither profitability nor college performance. The college comparison will populate when the authenticated rankings feed runs.

## Existing functionality checked

Season/recent-form blending, workload × efficiency, yardage outlier damping, RB carries/receiving/receptions, official availability labels, QB replacement evidence and manual neutral-site selection are already implemented and covered by the regression suite. No new snap-count feed or fitted player-talent blend was added. Available historical samples do not justify claiming full probability calibration for adjusted live scenarios.

## Verification and remaining access limits

The complete suite passes 350 tests after the above fixture repairs. New checks cover automatic weather/injury ordering, manual-edit preservation, failed-model retries, college maintenance, contradictory odds and raw blowout frequencies. Syntax/diff checks and the historical replay also pass.

The Railway site returns HTTP 401, and this session has no authenticated browser session. Therefore production API credentials, actual current FanDuel market coverage, current college replay results, and authenticated visual behavior have not been verified. These are remaining checks, not completed live-feed repairs. No credentials or access settings were changed.
