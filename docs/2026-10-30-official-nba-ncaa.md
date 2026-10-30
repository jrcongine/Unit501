# Batch 2: official NBA and NCAA reconciliation

Continues the previously deployed NFL gamebook, missing-history, replacement-player, denominator and median fixes. Does not repeat or replace those changes.

## Changes

- NBA histories now reconcile known player identities against NBA.com completed box scores. Explicit played flags, DNP/inactive lists, individual statistics, player totals, minutes, final scores, teams, season and game time are checked before use. Missing appearances can be filled, including actual zero-stat appearances. Conflicts with existing records block that player's projection.
- NBA replay uses the same official reconciliation for prior histories and actual outcomes; prior history remains strictly before the target game. Conflicting actuals are not graded. Official-game coverage is returned separately.
- College football now attempts NCAA official box scores before the existing ESPN secondary reconciliation. Positive participation evidence permits supported omitted-category zeros. Targets and unsupported participation remain unknown; absent players are not inferred DNP.
- College basketball histories use NCAA box scores with explicit game, team, season and score matching. NCAA basketball uses the season's starting year; the ESPN season uses its ending year. Positive minutes or actual gameplay statistics establish participation. Zero rounded minutes without other evidence remain unknown.
- NBA/NCAA history displays report the number of records checked against official statistics. NCAA history requests have a longer timeout for bounded official-source requests.
- Public NCAA persisted-query hashes are discovered from the site's published configuration. Fixed official origins, response bounds, request timeouts and caches constrain retrieval. Missing, ambiguous or unsupported official pages fail closed and preserve existing source/coverage safeguards.

## Verification

Live official-source adapter checks on October 30, 2026 succeeded for Cleveland at Atlanta (NBA game 0022600144, October 29), Pittsburgh at Miami (NCAA game 6604312, October 24), and Rutgers at Maryland (NCAA game 6503738, March 1). The Maryland box identifies Aleks Alston with 3.8 minutes and zero points, rebounds, assists and threes. Fixtures retain the relevant official statistical responses.

Automated tests cover source identity, totals, explicit DNP, valid zero appearances, ambiguous names, mismatches, zero rounded minutes, missing-game reconciliation, official query discovery/cache behavior, and replay restoration/conflict rejection. Full suite: 702 tests passing; git diff whitespace check clean.

## Limits

This is source-backed runtime reconciliation, not an exhaustive historical database rewrite or an assertion that every player and market has complete official coverage. NCAA box scores do not provide reliable full participation/DNP lists for every sport. Unsupported categories, absent names, conflicts and failed source requests remain unknown or unavailable. NCAA championship pages using a different page format are currently unavailable to this adapter. Existing incomplete-history gates continue to apply. No new calibration or profitability claim is made for NBA backtesting.

Authenticated production screens and paid-provider end-to-end requests could not be checked in this session. The primary Railway service has live provider configuration; the secondary has no live provider credentials. Deployment status, commit and public health checks are verified separately after publication.

## Follow-up: optional-source failure isolation

The NBA history and replay callers now isolate unexpected official-source exceptions from the validated ESPN response. An official-source outage does not erase valid secondary history or skip the entire replay. It contributes zero official verification; missing-player coverage gates still prevent partial-history projections. Added integration tests verify restoration of a known missing zero appearance before coverage calculation, live-history fallback, and replay fallback with missing-record withholding. Full follow-up suite: 705 tests passed, zero failures.

## Follow-up: unresolved basketball minutes

NBA and college basketball rows with missing/malformed or rounded-zero minutes now stay in an explicit unverified collection, outside the played-game count. Coverage counts them as missing and blocks projections until resolved. Previously they were stored as appearances despite the player being unavailable.

Known numerical market values are retained as conflict evidence. A uniquely matched official played row can restore the appearance only when those values agree; contradictory official DNP or market values remain blocked. Reconciliation does not clear unrelated player conflicts. NBA replay uses the same distinction for histories and target outcomes. This also allows an official zero-stat appearance to restore a complete history without inventing a DNP.

Validation: 708 tests passed, zero failures. New integration cases cover both basketball leagues, missing/zero minutes, successful official restoration, conflicting statistics/DNP, and replay historical/actual repair. Whitespace check passed. No college postseason feature was added: the app's college basketball context still requires regular-season games, so championship-page support remains outside the active projection path. Authenticated production UI verification remains outstanding.

## Follow-up: ambiguous football game dates

The NFL/CFB shared form calculation now collapses duplicate kickoff records into one unresolved game instead of counting both. Its values cannot enter the average, recency weighting, workload/role comparison or projection. Coverage records the unresolved game as missing. This is deliberately conservative even for identical duplicate rows: identity must be resolved before counting the game.

Football replay and historical-error ranges no longer discard ambiguous prior games to manufacture a smaller complete history. Later forecasts/ranges remain withheld; chronologically earlier valid predictions remain unchanged. Explicit conflict rows cannot be graded as actual outcomes. Tests cover every supported football statistic, identical/conflicting duplicates, baseline withholding, replay eligibility and historical range withholding. Full suite: 710 passed, zero failed; whitespace check clean. Existing authentication and source-coverage limitations remain unchanged.

## Follow-up: conflicting workload evidence

Explicit conflict rows now retain their dated game slot without contributing numerical evidence to the shared NFL/CFB workload and role calculations. Previously, projection withholding worked, but retained conflicting numbers could inflate workload averages or trigger usage-increase and absence-based opportunity alerts. The source records remain unchanged for reconciliation. Manual role reviews remain available.

Regression coverage checks passing attempts, carries and targets, latest/prior conflicts, missing-game counts, averages, role alerts, manual reviews and source preservation. The official-absence test also rejects conflicting latest workload. Full suite: 711 passed, zero failures. Production-screen authentication and broader official-source coverage remain outstanding.
