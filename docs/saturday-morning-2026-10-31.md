# Saturday morning reliability work — October 31, 2026

Baseline: `614b749cc35af2d48d15a444f8079ba28881eb95`. Reviewed recent commits, the master/movie-night work orders, football role/overlap and basketball absence documentation, market quality checks, and probability research. Both Railway Unit501 services had SUCCESS deployments of this baseline. Primary configured service: humble-amazement / Unit501 (`087dc2a0-0be8-4e8d-9f19-57350530b860`). Existing finished changes were preserved.

## New fixes

- NBA/CBB injury scoring honors missing and unverified player-history flags. Duplicate/conflicting participation, malformed rows, explicit team-ID mismatches, tied final scores, and absent/non-numeric scoring averages cannot support an injury adjustment. Previously an incomplete history could still change a score; undefined averages passed the subtraction-based reconciliation check. Supported samples still change the team estimate and simulation.
- College official injury collection verifies the provider's returned game ID and rejects incomplete pagination before collecting conference reports. Matching teams alone cannot relabel another game as the requested game. Applied to all configured conferences.
- NBA/CBB now provide an expandable **Compare player history — no betting line needed** panel under player props. Choose a player/stat and enter a whole/half-point threshold. It reports actual Above/Below/Equal appearances, includes verified zeros, excludes DNPs, and withholds incomplete, stale or ambiguous histories. These inputs never become FanDuel quotes, odds, line-history observations or betting recommendations. Current Out status does not erase historical results; no projection is shown in this panel.
- NBA player history loads independently of the odds request. CBB retains successfully loaded history when the prop feed fails or returns an invalid list. Both clear comparison state when changing games. Existing football entered-line and fixed touchdown comparisons were already implemented.

## Public injury-source check

The Big 12 publisher returned Arizona at Texas Tech, October 31 at 11:00 a.m. CT, published October 30 at 9:00 p.m. CT. It lists Jay'Vion Cole and Cole Rusk Out. The public Ourlads directory and both school depth parsers worked: Arizona has 79 parsed entries, Texas Tech 72. Arizona's October 25 publication lists Cole first-string at RCB and Rusk in reserves. This verifies public status/depth parsing, not live paid-provider IDs, historical participation, game-day starting assignments or numerical injury value. A reserve listing does not prove zero impact.

Sources:
- https://big12sports.com/sports/2025/8/14/FBreporting.aspx
- https://app.hdintelligence.com/api/get-publish-public (Football/B12 request)
- https://www.ourlads.com/ncaa-football-depth-charts/depth-chart/arizona/89946
- https://www.ourlads.com/ncaa-football-depth-charts/depth-chart/texas-tech/92062

## Verification

- Baseline after `npm ci`: 869 tests passed. The new basketball incomplete-history regression failed against the original implementation (95 points instead of retained 100), then passed after repair.
- Full regression suite: 874 passed, zero failures/skips/cancellations. The final CBB malformed-props guard also passed all 26 CBB client tests.
- Tests exercise actual NBA/CBB client scripts with controlled provider responses, odds failure, zero-stat history, pushes, source expiry and game switching; injury tests include score-to-simulation propagation. Updated the script-order assertion for the new shared component.
- `git diff --check` passed. No real-browser visual or authenticated live-provider acceptance is claimed.
- Replayed `node scripts/basketball-probability-diagnostics.js`: NBA 400 training / 750 later evaluation games; existing Brier 0.22110494, research candidate 0.21340962. CBB has only 2 training / 24 evaluation games. Results reproduce prior research; no coefficients deployed. The NBA archive is previously inspected, not an untouched holdout, and lacks historical injuries/odds/travel.
- Primary public health returned `ok:true, private:true, liveData:true`. Primary NBA page returned HTTP 401; secondary NBA page returned HTTP 503. These do not verify authenticated app behavior. Railway deployment IDs/status for this change are reported separately after publication.

## Work-order disposition and limits

| Items | Status after this work |
|---|---|
| 1–7 injury intelligence | Additional shared safeguards and current Texas Tech–Arizona public checks delivered. Existing official feeds, depth/usage gates, baseline-overlap correction, replacement scenarios and experimental basketball absence model retained. Universal roster/depth coverage, defensive/blocking participation and calibrated replacement quality remain incomplete. Missing data still means unknown. |
| 8–13 props | Independent history comparison now works in NBA/CBB without current odds; football already supports entered thresholds. Shared quote parsing, matching, timestamps and history protections pass regression checks. Full live FanDuel website/provider parity remains unverified; no lines invented. |
| 14–18 predictions | Existing strength, home-field, rest/travel/form and upset safeguards reviewed through source, prior audits and regressions. Rest/travel displays do not establish calibrated score effects. Prior probability audit reproduced; no unjustified weight/calibration changes. Independent validation and broader college samples remain necessary. |
| 19–21 quality control | New injury identity/participation/scoring checks and browser-flow regressions added. Existing stale odds/data-health checks pass. Controlled pipeline tests do not substitute for protected production acceptance. |

The remaining access requirement is an authenticated production session or securely configured app access in the execution environment. Existing credentials, authentication protections, subscriptions, provider settings and production data were not changed. Do not interpret successful deployment, public health or fixture tests as proof of complete live coverage or improved betting returns.
