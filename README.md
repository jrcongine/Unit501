# UNIT 501 v0.4

Private NFL + college-football simulation app foundation.

## Run
Requires Node 18+.

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

## Next build
Normalize FanDuel bookmaker markets automatically, calculate ratings from historical team stats, add injuries/weather, prop projections, bankroll/unit ledger, and backtesting/calibration.


## College team rankings

The 2026 FBS membership snapshot in `fbs-2026.json` is sourced from ESPN's season-specific FBS conference standings (source URL included), verified October 2, 2026. It contains 138 programs, including transitioning teams. These are Unit501 statistical rankings, not AP/CFP poll rankings or official NCAA rankings.

College comparisons load the league schedule and completed team box scores before the selected kickoff. Selected teams load first; their averages stay visible while national data loads. Each category receives ranks only when all 138 verified programs have games and complete data for that category. Ties use competition ranking (1, 1, 3). FCS teams retain averages but never enter the FBS ranking pool. Unknown seasons keep team averages without assuming 2026 membership.

The first college load needs one schedule request plus one box-score request per relevant completed game (potentially several hundred). Requests are paced at one second plus provider latency. Box scores are reused across matchups for 24 hours in memory and the existing temporary-disk cache; redeployments may clear disk. This uses the existing API-Sports quota. The screen reports progress and category coverage; incomplete provider data withholds the affected ranks. Future seasons need a new verified membership snapshot. Team-name mismatches are reported rather than guessed. These display stats still do not alter predictions.

Validation: `node test/rankings.test.js` covers FBS/FCS separation, aliases, missing data, ties, cutoff/season rules, NFL regression, full-league fetching, and cache reuse. Live API-Sports national coverage must be checked after deployment; no production API key is needed for these fixture tests.
