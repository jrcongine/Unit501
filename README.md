# UNIT 501 v0.4

Private NFL + college-football simulation app foundation.

## Run
Requires Node 20+ (uses `fetch` and `AbortSignal.timeout`).

```bash
cd unit501
export API_SPORTS_KEY='your_api_sports_key'
npm start
```

Open http://localhost:5010

Without a key the UI loads in demo mode. With a key, the server proxies API-NFL/NCAA requests so the secret never reaches the browser.

## Current build
- NFL/NCAA selector
- Date-based real schedule endpoint
- Server-side API-Sports authentication
- Per-game odds endpoint
- 50,000-run Monte Carlo game simulator
- Mobile/iPhone-friendly UI

## Current football extensions
FanDuel game/prop matching, historical team ranks, roster/injury review, NFL/FBS production ratings and confirmed replacement scenarios, venue/wind scenarios, season/usage prop projections and historical replay. See the audit for remaining work.


## College team rankings

The 2026 FBS membership snapshot in `fbs-2026.json` is sourced from ESPN's season-specific FBS conference standings (source URL included), verified October 2, 2026. It contains 138 programs, including transitioning teams. These are Unit501 statistical rankings, not AP/CFP poll rankings or official NCAA rankings.

College comparisons load the league schedule and completed team box scores before the selected kickoff. Selected teams load first; their averages stay visible while national data loads. Each category receives ranks only when all 138 verified programs have games and complete data for that category. Ties use competition ranking (1, 1, 3). FCS teams retain averages but never enter the FBS ranking pool. Unknown seasons keep team averages without assuming 2026 membership.

The first college load needs one schedule request plus one box-score request per relevant completed game (potentially several hundred). Requests are paced at one second plus provider latency. Box scores are reused across matchups for 24 hours in memory and the existing temporary-disk cache; redeployments may clear disk. This uses the existing API-Sports quota. The screen reports progress and category coverage; incomplete provider data withholds the affected ranks. Future seasons need a new verified membership snapshot. Team-name mismatches are reported rather than guessed. Scoring averages now drive the game simulation; rushing and passing ranks remain context only.

Validation: `node test/rankings.test.js` covers FBS/FCS separation, aliases, missing data, ties, cutoff/season rules, NFL regression, full-league fetching, and cache reuse. Live API-Sports national coverage must be checked after deployment; no production API key is needed for these fixture tests.


## Football model and historical check

The current scoring/projection changes, validation method and remaining live-data work are documented in [FOOTBALL-AUDIT.md](FOOTBALL-AUDIT.md).

Scoring uses offense plus opposing defense deviations around the game-weighted league scoring environment, with four league-average pseudo-games for sample smoothing. Schedule, venue, user injury scenarios and fresh outdoor wind adjustments then apply. Complete schedule scores are available before national yardage rankings finish. Simulation variance can use earlier chronological replay errors when at least 30 predictions are available; frequencies remain experimental. The Historical model check compares new and previous score errors and shows later-game away-win reliability.

Run `npm test` for regression and client-flow checks. Actual provider coverage, current prop quotes and production accuracy require deployment validation with the configured API keys.

Football player ratings, confirmed replacement scenarios and gated probability calibration are described in [FOOTBALL-MODEL.md](FOOTBALL-MODEL.md). Basketball/baseball remain deferred. Unsupported positions and incomplete data stay explicitly unrated or withheld.


## 501 War Room
The collapsible **501 War Room** panel records one proposed bet (matchup, exact selection, date, line/price) at a time. J.R., Aria, and Unit 501 each get one independent **For / Against / Not cast** vote. Two For votes approve the candidate, two Against votes reject it, otherwise there is no majority. A vote is a manual record, not an AI-generated endorsement.

Covers, WagerTalk, Juice Reel, and EV are non-voting research sources. The panel links to the first three sources and provides plain-text fields to manually record each source's current opinion and source/date; the notes and outcomes are not independently verified. The public-pick feed described below retrieves readable free selections from Covers and WagerTalk. The scouting desk now links directly to six YouTube channels' video pages: Kyle Kirms, Action Network, SportsLine, BettingPros, WagerTalk, and Guy Boston Sports. **EV (Ev Singleton) and Guy Boston Sports are the same channel/source** and must not be counted as independent consensus. This link directory does not fetch new videos, auto-extract picks, or certify profitability.

Board decisions are frozen once saved; final results are manually graded as won/lost/push/void/pending. The displayed W–L counts only approved, graded selections, excluding pushes and voids, and is **not** a verified profit/loss or sportsbook-settlement ledger. War Room data uses versioned browser-local storage and is separate from the forecast archive. Download JSON backups regularly; merging a compatible backup preserves existing records by ID. No cross-device sync is provided.


### Public picks inside the War Room
Opening the War Room loads attributed NFL public selections from Covers and WagerTalk; choose College football for that league. Each card shows the exact published selection/price, analyst, game timing as displayed by the source, release timing as of retrieval, and an original-source link. This is a league feed, not a Game Lab matchup filter. It never casts votes, changes model projections, or represents those prices as live FanDuel quotes.

The server fetches only four fixed public URLs, with a 12-second deadline, 2.5 MB response limit, five-minute cache and shared in-flight requests. No API key is needed. Missing/changed markup or upstream errors are shown explicitly; failed refreshes do not reuse old picks. WagerTalk selections with known kickoff times are removed once started. Covers exposes source-formatted event timing; check the displayed event date because it is not independently matched to the schedule. No premium packages or article analysis are copied.

EV and the other YouTube channels remain video research links; video picks are not transcribed. Juice Reel has no connected feed and remains manual review. Browser-local board notes and vote behavior are unchanged.


### Forecast miss diagnostics
Under **Saved forecast accuracy**, open **Where projections miss — recent patterns & examples** to see league/market-separated game-level high/low counts, last 10 versus previous 10 matched-game average absolute misses, a largest archived miss example, and selected-pick W–L–push–pending counts by market (including spread and total). Records must have been saved before kickoff in that browser and matched to final results. The diagnostics reuse the identical admissibility, no-future-info, duplicate, and single-model-per-market gates of the underlying accuracy audit. Games with more prop rows get only one game-level vote. A directional review flag requires at least 30 eligible games and ≥70% game-level misses pointing the same way; this is a manual-review heuristic, not automatic tuning, statistical significance, demonstrated betting value, or validated improvement. Latest/previous are windows of up to 10 *matched games* each, not date windows. For score forecasts, game bias can hide offsetting opposite-team errors; inspect the individual largest miss and absolute error together. Spread/total picks are graded separately from forecast error and do not establish sportsbook settlement or profit. No earlier forecasts can be reconstructed if they weren't originally saved.


### Prop comparison data support
The player comparison board and individual cards now show a **data support** label:
thin (2–4 recorded games), developing (5–8), or larger (9+), with review
flags for missing or latest-game statistics, uncertain workload, efficiency
outlier adjustments, user/lineup scenarios, and conditional availability.
Filter the board by data support and preserve the same label in copied lists.

This is a transparent input-coverage checklist, **not** an empirically
calibrated confidence score, probability, value/EV estimate, or recommendation.
Even a larger clean sample does not confirm participation, a starting role, a
current sportsbook line, or a profitable edge. Thin samples can remain on the
board for review rather than being silently dropped. The existing forecasting
formulas, saved archive, price freshness rules, and user shortlist choices are
unchanged.


### Market reliability (saved pregame props only)
Inside **Saved forecast accuracy**, expand **Market reliability — recorded results
by prop type**. The read-only table counts distinct completed games, matched
player targets, and pending statistics within the *same league, season, model
version and prop market*. It shows game-weighted average absolute miss, signed
bias, and latest vs previous ten matched-game error windows. A game with ten
player forecasts counts once, not ten times. Comparisons require 30 distinct
matched games in that exact subgroup; changes greater than 10% (with a
0.1-stat-unit minimum) receive a descriptive "recent error higher/lower"
review label, not a significance claim.

This table shares the existing forecast audit's eligibility rules: reject
ambiguous duplicates, invalid or late forecasts, and mixed model versions.
Selected-pick copies are excluded. No historical outcomes are reconstructed,
missing stats remain unknown, and units cannot be compared across markets
(e.g. yardage vs touchdowns). The archive is browser-local and can be incomplete.
**This feature does not validate probabilities, rank betting opportunities,
establish future accuracy, or change model predictions.**


### Automatic injury scoring (experimental)
Game Lab defaults to **Automatically apply conservative injury scenarios**. On each simulation,
Unit 501 checks the live, game-scoped official NFL **Out** list against fresh roster
membership and a unique rank-one player position on the matching depth chart. It
uses intentionally small, **hand-set and unvalidated positional sensitivities**:
defensive starters roughly 0.3–0.5 extra opponent points and eligible offensive
starters roughly 0.15–0.35 lost team points, capped at two per team and side.
These are *sensitivity scenarios*, not measured player value or calibrated
predictions. There is no automatic QB point estimate; it needs supported
replacement passing production.

Both teams must have fresh, matching official injury reports, rosters and depth
charts; if either side lacks coverage, no automatic injury points apply for
*either* team. This prevents one-sided report gaps from biasing the simulation.

Unmatched reports, conflicting ownership or statuses, conditional players, stale
feeds and unmatched depth roles receive **no score adjustment and a visible
warning**. Zero does not establish player health. Incomplete or missing feed
coverage does not invent absences. A player already reduced in a confirmed
lineup workload scenario cannot also receive an automatic estimate.

The four manual injury fields are disabled while automatic mode is on and display
the current auto-calculated adjustments after a simulation. Switch automatic
mode **off** to enter your own four point adjustments; switching modes clears the
old point values to prevent carryover. Injury-feed refreshes invalidate saved
on-screen simulation outputs so stale results cannot be mistaken for fresh
ones; rerun the simulation.

**Important:** Season averages may already reflect earlier absences, so even a
confirmed current Out report does not prove how much the upcoming game's
performance changes. This heuristic still requires chronological backtesting,
especially in weeks with repeated absences. It does not change or backfill
past saved forecast records. Do not interpret auto values as trustworthy
betting edges or guaranteed injury scoring.
