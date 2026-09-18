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
