# Unit 501 — October 30 master work-order audit

This is a truthful task ledger, not a claim that all 108 items are finished.
Task numbers match the owner's master work order. “Verified” includes source inspection,
automated regression checks and the local browser checks described below; it does not imply
authenticated production feed acceptance. Broad requirements stay pending when only a subset works.

## Delivered in application commit 1d669a31bea8aa1879d82c1faaea1f832a380032

- Shared light-gray/off-yellow styling, wider desktop layout, readable headings, row separators,
  retained purple repeated-pick treatment, compact weather styling and tagline on all four pages.
- Folded optional football scenario/venue/weather controls into Game settings. Moved methodology
  into Report Details. Reduced NBA introduction/watch clutter and obsolete Big 12 messaging.
- Automatic injury mode hides manual inputs, including empty Pending fields; manual mode restores
  controls. Compact summary distinguishes incomplete coverage and supported applied adjustments.
- NBA exact-player selection preserves player catalog order. College basketball gains a compact
  comparison table, exact-player selection, percentage-based sorts, sample sizes and pushes,
  shared verified movement descriptions and local stale-quote expiration.
- Data Health adds football history and college expert coverage, recognizes HTTP 429 failures,
  rejects falsely healthy/empty injury reports, shows unchecked feeds under attention, and uses CT.
- College basketball War Room uses the existing four-source/consensus pipeline and original
  source attribution rules. No guessed expert votes or public betting percentages were added.

## Verification and limits

Baseline: 9a4894e, 711 passing tests. Final application suite: 717 passed, zero failed/skipped.
New cases cover partial official injury reports, HTTP 429 status, football history telemetry,
exact NBA selection/catalog order, college percentage sorting/stale quotes, and college feed routes.
Updated one obsolete text assertion for intentional removal of Big 12 messaging.
`git diff --check` and JS syntax checks passed.

Local Chromium checks at 1440×1000 and 390×1000: football, NBA, college basketball and Data Health
had no page-level overflow or JavaScript errors. Inspected screenshots and corrected contrast.
An isolated football response exercised selected-matchup weather rendering and both injury modes.
These fixtures are layout checks, not live statistical verification; production credentials were
not copied, changed or bypassed. NBA/college loaded-data flows also have existing client regressions.

Public War Room check returned 230 structurally valid selections across the original five leagues;
MLB was empty. New college basketball check returned 3 Covers and 1 Pickswise selection; WagerTalk
and Boyd's were empty. Counts are transient and do not prove every analyst/date is independently
verified. Source pages returned HTTP 200 with college-basketball titles.

Replayed existing NFL HFA audit: 195 held-out games; optional variable HFA worsened margin MAE
from 10.77 to 10.89 points. Kept the default. No new profitability or calibrated-confidence claim.

Railway primary: humble-amazement / Unit501, persistent line-history volume and provider variable
names present. Secondary: successful-motivation / Unit501. Both track this repository's main.
Deployment IDs and final status are recorded below after verification.

Actual blocker: authenticated production access. OAuth returns variable names only; the cloud
browser reports `ERR_INVALID_AUTH_CREDENTIALS`. API capacity, paid-feed coverage, pregame freshness
and authenticated end-to-end behavior remain unverified. A public health 200 is not a substitute.
No billing change or subscription purchase is required/authorized by this audit.

## Per-task classification

| # | Requirement | Classification | Evidence / remaining scope |
|---:|---|---|---|
| 1 | Missing zero-stat games | Blocked by an actual external dependency | Official adapters exist, but absent/ambiguous participation and unsupported market fields remain unavailable. No fabricated zero or DNP; complete universal historical coverage cannot be certified. |
| 2 | Zero / DNP / unknown distinction | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 3 | Jonnu Smith discrepancy | Already completed and verified | Existing reviewed official gamebooks: seven appearances; 94 yards; over 3.5 yards 4 hits/3 misses; over 1 reception 2 hits/3 misses/2 pushes; Oct 29 DNP. Fixtures pass; authenticated current screen not checked. |
| 4 | Official history verification | Blocked by an actual external dependency | Official adapters exist, but absent/ambiguous participation and unsupported market fields remain unavailable. No fabricated zero or DNP; complete universal historical coverage cannot be certified. |
| 5 | Hit-percentage sorting | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 6 | Games / hits / misses / pushes | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 7 | Withhold false 100% rates | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 8 | Recalculate affected summaries | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 9 | Replacement and NBA replay audit | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 10 | Team records and provider IDs | Still pending | Existing exact league/season/name standing mapping and collision tests pass; complete live all-sport season-record coverage remains unverified. |
| 11 | Incomplete-data confidence gate | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 12 | Regression checks | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 13 | Live 7,500 request entitlement | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 14 | All-sport FanDuel coverage | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 15 | Automatic loading and refreshing | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 16 | Pregame roster/trade/depth freshness | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 17 | Complete Data Health coverage | Still pending | Added football team/player history telemetry and college basketball expert feeds. Commit 5ca6e0a adds persistent status and rankings, player ratings, box scores, roster/official/depth subfeeds, standings/headlines, NBA travel/comparison/live scoreboards. Full live source acceptance remains pending. |
| 18 | Success times and stale warnings | Newly completed, tested, and deployed | Retained real success/source timestamps; Central Time display; unchecked feeds appear under Needs attention. Fixed 429 and missing official injury coverage falsely retaining healthy status. |
| 19 | Quota-aware retries | Already completed and verified | Existing provider retry and API-meter budget/cooldown/concurrency tests pass. No allowance or billing plan changed. |
| 20 | Confirmed pregame roles | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 21 | Opening versus current lines | Still pending | Existing persisted first-observed history and quota-reserved watch continue; a true opening line and automatic collection of every game are not guaranteed. |
| 22 | Timestamped odds history | Still pending | Existing persisted first-observed history and quota-reserved watch continue; a true opening line and automatic collection of every game are not guaranteed. |
| 23 | Movement amounts and arrows | Already completed and verified | Existing shared observed-history tests pass: arrows/deltas, first-observed labels, no unchanged claim without separate dated observations. College props now use same helper. |
| 24 | No unsupported unchanged label | Already completed and verified | Existing shared observed-history tests pass: arrows/deltas, first-observed labels, no unchanged claim without separate dated observations. College props now use same helper. |
| 25 | Live scores/status/grading | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 26 | Compact weather graphics | Already completed and verified | Existing forecast/weather-app renderer preserved, exercised with isolated weather response. This batch restyled it; no invented forecast values. Actual live forecast requires authenticated production check. |
| 27 | Recognizable weather icons | Already completed and verified | Existing forecast/weather-app renderer preserved, exercised with isolated weather response. This batch restyled it; no invented forecast values. Actual live forecast requires authenticated production check. |
| 28 | Temperature/wind/rain/forecast | Already completed and verified | Existing forecast/weather-app renderer preserved, exercised with isolated weather response. This batch restyled it; no invented forecast values. Actual live forecast requires authenticated production check. |
| 29 | At-a-glance weather effects | Already completed and verified | Existing forecast/weather-app renderer preserved, exercised with isolated weather response. This batch restyled it; no invented forecast values. Actual live forecast requires authenticated production check. |
| 30 | Reduce main-screen explanations | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 31 | Expandable Report Details | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 32 | Wider layout and spacing | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 33 | High-contrast headlines | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 34 | Light backgrounds | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 35 | Player/prop/stat separators | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 36 | Remove empty/duplicate panels | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 37 | Remove Why Highlighted banner | Already completed and verified | No Why Highlighted banner rendered; existing concise role reasons preserved. |
| 38 | Purple Repeated Picks | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 39 | Mobile and desktop layout | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 40 | Team season records | Still pending | Existing exact league/season/name standing mapping and collision tests pass; complete live all-sport season-record coverage remains unverified. |
| 41 | Rest in days | Already completed and verified | Existing Central-calendar full-days-off display preserved in football/NBA/college basketball; regression suite passes. |
| 42 | Recent results and verified travel | Still pending | Recent results and verified travel helpers exist; full cross-sport travel/logo/game-card parity is not complete. |
| 43 | Logos and consistent game cards | Still pending | Recent results and verified travel helpers exist; full cross-sport travel/logo/game-card parity is not complete. |
| 44 | Selected-player props only | Newly completed, tested, and deployed | NBA exact-player selector and catalog order added; college basketball gains exact selector and catalog order; football selector retained. |
| 45 | Catalog-order props | Newly completed, tested, and deployed | NBA exact-player selector and catalog order added; college basketball gains exact selector and catalog order; football selector retained. |
| 46 | Comparison table | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 47 | Projection/median/line/gap/recent/workload/movement | Still pending | College table now exposes projection, median, line, gap, recent/workload and movement. NBA retains comparison table and these values; basketball scenario parity is delivered in 5ca6e0a; full supported-market parity remains unfinished. |
| 48 | Compact statistics panels | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 49 | Confirmed role/usage alerts | Still pending | Existing football role alerts reject conflicted evidence. NBA minutes trends remain explicitly historical; no unsupported confirmed promotion labels added. |
| 50 | Above/Below/Equal samples | Newly completed, tested, and deployed | Existing football/NBA hit-rate arithmetic preserved; college basketball adds percentage sorts, sample sizes and pushes. Incomplete projections sort below available ones. |
| 51 | All-player percentage sorts | Newly completed, tested, and deployed | Existing football/NBA hit-rate arithmetic preserved; college basketball adds percentage sorts, sample sizes and pushes. Incomplete projections sort below available ones. |
| 52 | Correct high/low sorting | Newly completed, tested, and deployed | Existing football/NBA hit-rate arithmetic preserved; college basketball adds percentage sorts, sample sizes and pushes. Incomplete projections sort below available ones. |
| 53 | Do not verify incomplete histories | Already completed and verified | Preserved stat-integrity, participation, replacement, sorting and replay protections; 717-test suite passes. Supported records only, not universal source coverage. |
| 54 | Player scenarios | Newly completed, tested, and deployed | Commit 5ca6e0a adds per-player NBA/college Normal 0%, Star Power +10%, Rivalry Dud −10%, Fatigue −5%. Recorded statistics remain unchanged; scenarios cannot compound and reset between games. |
| 55 | Lightning bolt icon | Newly completed, tested, and deployed | Football retained; basketball Star Power and Rivalry Dud controls use ⚡. |
| 56 | Football/basketball market consistency | Still pending | College table now exposes projection, median, line, gap, recent/workload and movement. NBA retains comparison table and these values; basketball scenario parity is delivered in 5ca6e0a; full supported-market parity remains unfinished. |
| 57 | Betting percentage source audit | Already completed and verified | Main football UI already removed unreliable betting shares and disables their scoring input. No invented percentages or auto-restoration; source attribution/consensus tests pass. |
| 58 | Hide unsupported percentages | Already completed and verified | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 59 | No fabricated percentages/consensus | Already completed and verified | Main football UI already removed unreliable betting shares and disables their scoring input. No invented percentages or auto-restoration; source attribution/consensus tests pass. |
| 60 | No placeholder betting numbers | Already completed and verified | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 61 | Verified-only percentage restoration | Already completed and verified | Main football UI already removed unreliable betting shares and disables their scoring input. No invented percentages or auto-restoration; source attribution/consensus tests pass. |
| 62 | War Room feeds | Newly completed, tested, and deployed | Live public feed checks: NFL/CFB/NBA/NHL sources readable, MLB empty; college basketball 3 Covers + 1 Pickswise, other sources empty at check. Attribution structure verified, not every analyst/date independently confirmed. |
| 63 | Actual expert selections | Newly completed, tested, and deployed | Live public feed checks: NFL/CFB/NBA/NHL sources readable, MLB empty; college basketball 3 Covers + 1 Pickswise, other sources empty at check. Attribution structure verified, not every analyst/date independently confirmed. |
| 64 | Consensus vote counts | Already completed and verified | Existing pick-consensus identity/grouping tests pass. Only matching source selections contribute; unverified dates/identities remain constrained. |
| 65 | Missing consensus groups | Already completed and verified | Existing pick-consensus identity/grouping tests pass. Only matching source selections contribute; unverified dates/identities remain constrained. |
| 66 | Preferred sources | Already completed and verified | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 67 | War Room sport parity | Newly completed, tested, and deployed | Added college basketball to server allowlist, all four source URLs, selector, health inventory and smoke check; empty feeds do not supply invented votes. |
| 68 | Expert/model separation | Already completed and verified | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 69 | Compact War Room | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 70 | Audit all model engines | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 71 | Kennesaw ranking review | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 72 | Power and schedule strength | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 73 | Opponent quality | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 74 | Offense/defense matchups | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 75 | Injury/rest/travel/HFA inputs | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 76 | Close-game bias | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 77 | Totals/scoring distributions | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 78 | Upset detection | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 79 | Market disagreement alerts | Still pending | Shared point-gap display implemented for NFL/college football/NBA/college basketball. NBA uses current validated FanDuel lines; football/college basketball use explicitly labeled editable entered lines. Large-gap review flags are display thresholds, not calibrated edges. Authenticated production acceptance still needs checking. |
| 80 | Historical segmented backtests | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 81 | Measured confidence | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 82 | Workload/matchup/availability props | Still pending | Existing model code/tests and previous validation reviewed. No new held-out proof of improved predictions, contextual weights or all-league calibration. These remain research/implementation work, not completed fixes. |
| 83 | Validate contextual adjustments | Still pending | Replayed NFL variable-HFA audit on 195 held-out games: candidate margin MAE 10.89 vs baseline 10.77, so default retained. Prime-time/rest/upset validation remains open. |
| 84 | Optional game modes | Already completed and verified | Football manual Normal/Upset/Primetime modes retained separately from HFA; labels now show 0%/−10%/+10%. No redundant Upset checkbox. |
| 85 | Separate modes from HFA | Already completed and verified | Football manual Normal/Upset/Primetime modes retained separately from HFA; labels now show 0%/−10%/+10%. No redundant Upset checkbox. |
| 86 | Remove Upset checkbox | Already completed and verified | Football manual Normal/Upset/Primetime modes retained separately from HFA; labels now show 0%/−10%/+10%. No redundant Upset checkbox. |
| 87 | Finish basketball | Still pending | College props and War Room improved; automatic injury/rotation adjustments, combined basketball navigation, all-screen parity and independent calibration are not complete. |
| 88 | Shared basketball navigation | Newly completed, tested, and deployed | Commit 97b4f8e groups NBA and college basketball under one Basketball entry, with league links and current-page indication. Existing routes and Beta labels retained. Desktop/mobile navigation passed. |
| 89 | Complete basketball schedules | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 90 | Basketball odds and props | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 91 | Basketball roles/injury projections | Still pending | College props and War Room improved; automatic injury/rotation adjustments, combined basketball navigation, all-screen parity and independent calibration are not complete. |
| 92 | Official NBA injury integration | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |
| 93 | Basketball histories | Blocked by an actual external dependency | NBA/NCAA official reconciliation and unknown-history guards preserved. Full historical participation coverage still depends on usable official box scores; unknown records remain withheld. |
| 94 | Basketball simulations/backtests | Still pending | College props and War Room improved; automatic injury/rotation adjustments, combined basketball navigation, all-screen parity and independent calibration are not complete. |
| 95 | Basketball loading failures | Still pending | Commit 97b4f8e fixes Central-day NBA coverage across UTC dates in both sources, rejects incomplete responses and conflicting IDs. Live public check returned 10 October 30 games. Full private production acceptance remains pending. |
| 96 | Retain beta until verified | Already completed and verified | Beta labels retained because full basketball acceptance gates are not met. |
| 97 | Automatic/manual injury UI | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 98 | Compact color-coded injury summary | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 99 | College HFA | Already completed and verified | Existing college football venue/HFA model tests pass; college basketball page continues to disclose that HFA is not adjusted. |
| 100 | Central Time | Newly completed, tested, and deployed | Existing game Central Time helpers retained; Data Health now explicitly uses America/Chicago including DST labels. |
| 101 | Remove obsolete board emphasis | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 102 | Always Buy the Hook | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 103 | Preserve repeated picks/features | Still pending | Regression suite and desktop/mobile screens checked; local loaded football/weather/manual-toggle fixture checked. Full production all-sport loaded interaction QA still blocked by login. |
| 104 | Major screen QA | Still pending | Regression suite and desktop/mobile screens checked; local loaded football/weather/manual-toggle fixture checked. Full production all-sport loaded interaction QA still blocked by login. |
| 105 | Regression suite | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 106 | GitHub commit | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 107 | Railway deploy | Newly completed, tested, and deployed | See delivered changes and verification below. Completion applies to implemented scope; production login-dependent acceptance remains item 108. |
| 108 | Authenticated production behavior | Blocked by an actual external dependency | Private production authentication is unavailable. Railway OAuth exposes variable names only; browser returns ERR_INVALID_AUTH_CREDENTIALS. Current account entitlement and end-to-end paid/live-provider behavior cannot be checked. |

## Application deployment verification

Application commit: `1d669a31bea8aa1879d82c1faaea1f832a380032`.
GitHub Actions run [41099537725](https://github.com/jrcongine/Unit501/actions/runs/41099537725): completed SUCCESS.
Railway primary deployment `a8b38b12-bd42-4d5f-9058-7172260c2ae9`: SUCCESS.
Railway secondary deployment `c8589521-1d6b-4e49-8d57-ba9b134e1b0e`: SUCCESS.
Primary public `/api/health`: HTTP 200, `ok:true`, `private:true`, `liveData:true`.
That last flag only means the provider key is configured; it does not verify the plan or data quality.
Secondary public `/api/health`: HTTP 200, `ok:true`, `private:true`, `liveData:false`; it has no live football provider key. Primary remains the configured live-data service.
The follow-up commit containing this ledger changes documentation only.

## Continuation batch — 5ca6e0ab89f6a8ccdf5bfab03aebdc0dc7e92084

- Added bounded, atomic feed-status persistence beside the existing line-history file (or
  UNIT501_DATA_HEALTH_FILE). Original source/success times survive restarts; malformed files
  are preserved and storage errors are disclosed. No payloads, URLs or credentials are stored.
  Writes are debounced 500ms; abrupt termination can lose the latest unsaved observation.
- Expanded passive feed coverage; rankings loading/error states no longer register as success.
  NBA live scoreboard expires after three minutes, availability after fifteen minutes.
- Added optional per-player basketball scenarios without altering actual history, percentages,
  minutes or medians. Explicit manual/uncalibrated labels; reset on matchup changes.
- Local full suite: 723 passed, zero failures/skips. Targeted college client suite passed after
  adding scenario switching assertions. Desktop/mobile four-screen checks: no errors/overflow.
- Railway application deployment: primary 03cc6aec-c8e9-4df5-84d6-16682e30003c SUCCESS;
  secondary b777c672-25ef-4fba-a2d1-e90c76029a73 SUCCESS. Both identify commit 5ca6e0a.
- Primary public health responds OK, private true, liveData true. These flags do not verify
  entitlement, every feed, saved on-disk status or authenticated screens. The existing
  production-login blocker remains; GitHub Actions was still queued at this check.

Populated basketball fixture checks also exercised Star Power on both pages at 1440 and
390 pixels. This caught mobile filter-select overflow that empty tables did not reveal.
The follow-up CSS constrains filter widths and formats scenario controls; rerun passed
without page overflow or JavaScript errors at both sizes. Tables retain internal scrolling.

## Central-day schedules and basketball navigation — 97b4f8ec3e376f399b7518e34f3c58247ad99f4b

- Both NBA schedule adapters now request the two UTC dates overlapping the selected Central
  day, filter by America/Chicago, deduplicate identical games and reject conflicting IDs.
  Malformed rows and either-date request failures cannot silently produce a partial slate.
  This uses two requests per uncached complete day; caching and primary failure cooldown
  remain intact, and first-request plan denial stops before requesting the second date.
- Unified Basketball navigation with NBA/college links; existing URLs and Beta labels retained.
- 729 automated tests passed. New cases exercise both DST transitions, year end, caching,
  duplicates, missing half-day responses and mixed malformed/valid data.
- Populated NBA/college pages at 1440 and 390 pixels: no JavaScript errors or page overflow;
  scenario interaction and links between leagues passed.
- Live public ESPN check via the revised adapter returned 10 October 30 games, including
  five October 31 UTC tipoffs that belong to October 30 Central. This checks the public
  adapter locally, not authenticated Railway pages or the paid API-NBA response.
- Railway primary 2753e137-d9b5-4c26-b29d-e85d585ef802 and secondary
  2dce1b6a-a3f4-4884-b11c-7b17d3260ad4 both reached SUCCESS on 97b4f8e.

## Team-history gap safeguards — continuation

- NBA context now counts completed same-stage games missing scores. NBA estimates and
  simulations reject these gaps, conflicting games and malformed history records.
- The public NBA context adapter rejects mixed valid/malformed responses instead of
  silently dropping malformed events before coverage checks.
- College basketball estimates and simulations now honor the existing unverified-game
  count. Known gaps also suppress inferred rest days; recorded results remain visible
  with an incomplete-history warning. Both sports expose gaps in Data Health.
- 735 local automated tests passed, including adapter-to-model coverage and client checks.
  This is a data-integrity safeguard, not evidence of improved calibrated accuracy.
  Tasks 70/80/81/94 remain pending for independent model/backtest validation; private
  production feed/screen acceptance remains unverified.

## Current season records on matchup cards — continuation

- NFL, college football and NBA slate cards now show available current season records
  from the existing standings request. Exact unique names and matching league/season
  are required; unrelated provider team IDs are never matched numerically.
- NBA explicitly converts the schedule's start-year season to standings' end-year season.
  Historical dates, missing source timestamps, timestamps over an hour old or in the future,
  ambiguous team matches and failed refreshes withhold the record. A local timer clears
  stale card records without fetching providers. No new paid requests are introduced.
- Football selected-team record headings now apply the same freshness/date safeguard.
- 737 tests passed. Populated NBA record cards and basketball navigation checked at
  desktop/mobile sizes; no JavaScript errors or page overflow. College basketball and MLB
  record-card parity and authenticated production acceptance remain pending under 10/40/43.

## College basketball freshness and season records — continuation

- Player tables now re-evaluate history whenever rendered instead of retaining a calculation
  made when props were loaded. Local timers withdraw projections/hit percentages when history
  exceeds 30 minutes or a loaded availability report exceeds 15 minutes, while fresh quotes
  remain visible. Expired deadlines are not rescheduled in a tight loop.
- Reloading props refreshes an expired availability report. Invalid reports cannot become
  accepted availability state. Successful refresh can restore an eligible estimate; failed
  refresh cannot silently reuse stale availability. No background provider polling added.
- College basketball matchup cards now expose provider-supplied overall records only, with
  ambiguous, malformed and home/away-only records withheld. Cache source timestamps are
  retained. Records expire locally and are hidden for started, historical or TBD games.
- 741 local tests passed. Populated NBA/college screens and records passed 1440px/390px
  interaction checks without JavaScript errors or page-level overflow.
- College record-card parity is now implemented; MLB card parity, broad live feed acceptance,
  independent model calibration and private production-screen checks still need work.

## Model/line comparison — continuation

- Football and both basketball views show away-margin and total differences beside their
  estimates. Positive margin gap means Unit 501 favors the away side more; positive total
  gap means a higher model total. Correct away-spread sign and pick'em handling are tested.
- Review flags start at 7 spread points or 10 total points. These fixed display thresholds
  are disclosed in the explanation; they are not calibrated edges, confidence or picks.
  No scoring formula, market line or prediction is changed.
- NBA comparison uses only the market module's current matching FanDuel lines and clears
  with expired/missing quotes. Football and college basketball explicitly label comparisons
  against editable values as Entered lines. Empty inputs never become synthetic zero lines.
- 746 automated tests passed; cross-sport invalidation and line-change checks included.
  Populated NBA/college comparison screens passed desktop/mobile checks.

## Conflicting schedules and historical engine diagnostics — continuation

- Football rankings, opponent corrections and scoring replay no longer silently select
  one duplicate when scores, teams, kickoff, stage, status or venue disagree. Identical
  observations still deduplicate; IDs are scoped by league and season. Supplemental
  opponent conflicts cannot receive verified status. Invalid negative, fractional or
  boolean football scores are missing data, never valid scoring coverage.
- 750 automated tests passed. Two old fixture-only ID collisions were corrected so their
  original tests continue to exercise distinct unfinished games instead of contradictions.
- Added reproducible NFL 2024/2025 diagnostics by team, model-favorite side and Central
  kickoff group. Later samples contain 206/210 games. Total bias changes direction;
  no blanket totals reduction or margin expansion is justified by this replay.
- Collected and reconciled public NBA 2024–25 regular-season results: 1,230 finals,
  30 teams, 82 games each; individual event years verified despite erroneous current-year
  response wrappers. Kept source provenance and excluded five non-final entries plus
  the explicitly labeled NBA Cup Championship from this regular-season audit.
- Replayed NBA recent-five, recent-ten and season settings, with team/favorite segments.
  See docs/nba-replay-2026-10-30.md and docs/scoring-diagnostics-2026-10-30.md.
  No live model setting or confidence rating changed. These are descriptive historical
  comparisons, not new untouched holdouts or against-the-spread profitability tests.
- Tasks 70/76/77/80/81/83/94 have additional evidence but remain pending where they require
  other leagues, contemporary injury/market data, simulations or independent calibration.
  Production authentication and paid-feed acceptance remain blocked as recorded above.
