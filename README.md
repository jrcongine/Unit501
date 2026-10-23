# UNIT 501 v0.4

Private NFL + college-football simulation app foundation.

## Run
Unit 501 now requires owner authentication on every app and data route. Set
`UNIT501_PRIVATE_PASSWORD` in Railway Variables to a unique password of at least
16 characters. The browser login username is `jr`. Without this variable (or
with a shorter password), the app fails closed with a private-access message.
Use the Railway HTTPS address; Basic authentication must not be used over public
plain HTTP. `/api/health` remains available for health checks and performs no
paid provider requests. Keep the password out of GitHub and client-side code.

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

See [SPORT-ADAPTERS.md](SPORT-ADAPTERS.md) for the shared Football/NBA user journey, reusable UI helpers, feature gates, and the separate basketball ratings/calibration roadmap.

## NBA beta (schedule and scores only)

The NBA beta is intentionally separate from the NFL/NCAA simulator. Open `/nba.html` from the navigation to choose a date and retrieve the published NBA schedule and scores. No basketball predictions, odds, props or wagers are generated yet.

Selecting an NBA matchup now opens the same-style Game Lab layout and, when real team IDs/stage and provider access are available, calls a separate protected `/api/nba/context?date=YYYY-MM-DD&game=ID` endpoint. That endpoint loads each team's NBA games for the season, deduplicates the game IDs, excludes the selected matchup and **all later, still-live, or too-recent finished games**, and only compares games in the same stage. It displays available season/last-10/last-5 scoring averages and sample-size labels, **not** projected points, cover probabilities or prop picks. A new season may have no qualified games yet; don't fill that gap with preseason results or assumed values.

The server uses **API-NBA v2** (`https://v2.nba.api-sports.io/games?league=standard&season=2026&date=YYYY-MM-DD`). It requires valid access to API-NBA via `NBA_API_SPORTS_KEY` (preferred) or the existing `API_SPORTS_KEY` if entitled. Never expose these secrets in a browser. The system has not yet verified the Railway key's NBA subscription: if access is missing, the beta shows an unavailable state instead of fictitious games.

NBA daily slates are cached for 15 minutes and team-season histories for one hour, with concurrent requests shared between visitors. No automatic polling consumes provider quota. The free NBA plan shown in the account dashboard allows 100 requests/day; each distinct team-history lookup requires a separate request, so avoid repeated exploratory date changes. NBA years use the season's starting calendar year (e.g., January 2027 belongs to season 2026). Game statuses and null scores come directly from API-NBA. Provider failures and invalid payloads fail closed.

Next phases **after live data and model checks**: NBA team performance splits, pace and strength adjustment, historical score backtests, and only then player minutes / points-rebounds-assists props. College basketball is not included.

## Football API usage protection (October 2026)

Unit 501 now protects the paid **American-football** API subscription separately from free API-NBA access. GitHub code changes and test jobs do not use the owner's API-NFL key. Railway deploys can restart the backend and clear temporary caches; opening a single matchup may cause many live HTTP requests from box scores, rosters and availability reports.

- Automatic server-startup roster sweeps are **off** by default. To opt in, set `UNIT501_ENABLE_ROSTER_SWEEPS=1` in Railway; sweeps then run on a **24-hour** interval starting after startup, never immediately on deployment. Opening a game still fetches the reports it needs.
- Game Lab downloads **up to 16 detailed team box scores per season comparison**, starting with selected teams. Completed-game scoring and national scoring averages still use the schedule. Rushing/passing totals and national yardage ranks may be incomplete. The internal ranking adapter accepts `boxLimit:Infinity` for exhaustive test fixtures, not for production browsing.
- Outbound NFL/college football API attempts are counted by endpoint category. The default **7,500 requests per UTC day per Railway process** budget stops further requests once reached. Owner may set `UNIT501_FOOTBALL_DAILY_BUDGET` from 1 to 7,500 to adjust. The app shows an explicit failure rather than silently continuing expensive requests.
- Open **Football API usage** below the slate controls to see the process-only request count, categories, failures and blocked attempts. The protected `/api/provider-usage` endpoint returns the same numbers. **Counters reset whenever Railway restarts** and may miss traffic from other instances, deployments or API consumers. The API-Sports dashboard is the only authoritative account-level usage total. This counter is not a historical audit of earlier requests.
- These savings mean detailed rushing/passing rankings usually will **not** become fully populated from a single game load. Do not interpret missing ranks as zero, and do not change score projections to compensate for missing yardage box scores. The automatic player-ratings bulk build remains user-initiated with its checkbox off by default; the daily budget applies if someone runs it.

## Current football extensions
FanDuel game/prop matching, historical team ranks, roster/injury review, NFL/FBS production ratings and confirmed replacement scenarios, venue/wind scenarios, season/usage prop projections and historical replay. See the audit for remaining work.


## College team rankings

The 2026 FBS membership snapshot in `fbs-2026.json` is sourced from ESPN's season-specific FBS conference standings (source URL included), verified October 2, 2026. It contains 138 programs, including transitioning teams. These are Unit501 statistical rankings, not AP/CFP poll rankings or official NCAA rankings.

College comparisons load the league schedule and completed team box scores before the selected kickoff. Selected teams load first; their averages stay visible while national data loads. Each category receives ranks only when all 138 verified programs have games and complete data for that category. Ties use competition ranking (1, 1, 3). FCS teams retain averages but never enter the FBS ranking pool. Unknown seasons keep team averages without assuming 2026 membership.

The first college scoring comparison needs a schedule request; by default only up to 16 detailed team box-score requests are made, prioritizing the selected teams. Requests are paced at one second plus provider latency. Box scores are reused across matchups for 24 hours in memory and the existing temporary-disk cache; redeployments may clear disk. This uses the existing API-Sports quota. The screen reports progress and category coverage; incomplete provider data withholds the affected ranks. Future seasons need a new verified membership snapshot. Team-name mismatches are reported rather than guessed. Scoring averages now drive the game simulation; rushing and passing ranks remain context only.

Validation: `node test/rankings.test.js` covers FBS/FCS separation, aliases, missing data, ties, cutoff/season rules, NFL regression, full-league fetching, and cache reuse. Live API-Sports national coverage must be checked after deployment; no production API key is needed for these fixture tests.


## Football model and historical check

The current scoring/projection changes, validation method and remaining live-data work are documented in [FOOTBALL-AUDIT.md](FOOTBALL-AUDIT.md).

Scoring uses offense plus opposing defense deviations around the game-weighted league scoring environment, with four league-average pseudo-games for sample smoothing. Schedule, venue, user injury scenarios and fresh outdoor wind adjustments then apply. Complete schedule scores are available before national yardage rankings finish. Simulation variance can use earlier chronological replay errors when at least 30 predictions are available; frequencies remain experimental. The Historical model check compares new and previous score errors and shows later-game away-win reliability.

Run `npm test` for regression and client-flow checks. Actual provider coverage, current prop quotes and production accuracy require deployment validation with the configured API keys.

Football player ratings, confirmed replacement scenarios and gated probability calibration are described in [FOOTBALL-MODEL.md](FOOTBALL-MODEL.md). Basketball/baseball remain deferred. Unsupported positions and incomplete data stay explicitly unrated or withheld.


## 501 War Room
The **501 War Room** is a public-picks research panel, **not** a duplicate Big 12 voting form. J.R., Aria, and Unit 501 make their independent picks in chat; this app shows available outside selections to compare with the Game Lab.

Covers, WagerTalk, Boyd's Bets and Pickswise are the automatic public-picks sources. Choose NFL, college football, or MLB and refresh for attributed selections. Source cards show the published selection, attributed analyst where verified, available event/release information and a link to the original. Pickswise uses its explicit public selections table and links a pick to its analyst only when the corresponding visible card is matched; source best odds are not FanDuel quotes and listings may omit verifiable release/kickoff times. Source prices are not live FanDuel quotes, and missing, paid, or unreadable selections are not guessed.

Sportsbook Review and PickDawgz are **research links only**, not automatic integrations. The optional, collapsed YouTube scouting desk links five other channels (Kyle Kirms, Action Network, SportsLine, BettingPros, WagerTalk TV). Their videos are not transcribed into picks. EV / Guy Boston Sports was removed from the War Room because it has no automatically readable public pick feed.

Previous manual board records, including historical EV/Juice Reel comments, remain in browser-local storage and can be exported from **Previous War Room records** when entries exist. New manual board votes/entries and the manual decision log are no longer available in the War Room. These changes do not affect the separately saved forecast archive.

### Public picks inside the War Room
Opening the War Room loads public picks for the selected league from Covers, WagerTalk, Boyd's Bets and Pickswise. The server fetches their fixed public URLs with a 12-second deadline, a five-minute cache and shared in-flight requests. Unavailable or changed markup produces an empty/unavailable status, not fabricated picks. Pickswise may display an analyst-unverified label if the original page does not provide an unambiguous name; it needs a post-deployment smoke check against live HTML. Known-past kickoff picks from WagerTalk are excluded. Check the source date, event and current market price before considering any pick.

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


### Matchup-prep and line-monitor automation (experimental)
Automatic injury scoring is NFL-only and switches off when an FBS matchup is selected; college automatic game prep does **not** wait for NFL official injury and depth feeds, which are not comparable to college availability data. College injury point fields remain manual and default to zero.
**Automatic game prep** is enabled on matchup selection. It reuses existing
automatic current FanDuel spread/total, scoring, weather and availability
requests, starts player projections and their quoted prop comparisons, and runs
one pregame simulation **only once** after current odds, scored teams and both
teams' injury/depth coverage are ready. Missing inputs leave a visible
waiting message; you can still click Run manually. Optional **Also build
league-wide player ratings** is switched off by default because it consumes
many provider requests. The prep control never votes in the War Room or
places bets and never invents absent lines.

Fresh automatic FanDuel line captures show **first observed in this browser**
versus latest observed quote for the same matchup and market. Game spreads
and totals are shown next to the FanDuel refresh status; player props show an
extra comparison column and include movement in copied boards. The provider
timestamp must be current, increasing and available. These observations are
**not** an opening line, historical closing-line record or a source of
profitability measurements; manual prices and lines do not enter observations.

The prop board Show filter includes an **Automatic research queue**. This
only surfaces fresh, priced FanDuel lines with at least five recorded games,
no automated model support/review flags, no incomplete workload, and a
projection differing from the line. It is a data-quality filter for human
research, **not** a pick, hit probability or EV ranking. It preserves the
existing manual shortlist and independent J.R./Aria/Unit 501 War Room votes.


### Latest completed-day report and replacement review
The Saved forecast accuracy view now leads with the **latest game date
containing at least one final statistic in this browser's saved forecasts**.
It reuses the strict eligibility gates already applied to accuracy audits and
shows matched targets, game-weighted per-market absolute misses, signed bias,
and the statistical outcomes of any separately saved selected picks. Missing
box scores and earlier unsaved forecasts cannot be reconstructed; this is not
a bookmaker settlement or automatic profit ledger. The report updates when
the archive's final-result refresh completes.

After building league-wide player ratings, expand **Automatic missing-starter
replacement review** to see flagged offensive starters from current matched
availability reports and available same-position depth/usage candidates together
in one place. Missing profiles, unmatched roles and uncertain workload are
reported rather than filled. This is a **read-only proposal**: the existing
review/confirmation flow still controls whether any inferred replacement
touches or score changes actually apply. The automatic injury-point heuristic
and this workload-review display are separate.


### War Room public-feed refresh
When the 501 War Room is expanded and visible, published public picks are
rechecked once cached observations are at least five minutes old. It also
checks when you reopen the panel or return to the tab. Failed requests observe
the same cooldown; manual Refresh remains available. Source dates and links
are still required; EV and Juice Reel entries without an accessible public
pick feed remain manual and are **not** automatically filled or counted as
votes. Background polling stops when the War Room is closed.
