# Automatic FanDuel player props

Upload the ZIP contents to the repository root, keeping public/ and test/ folders. Commit to main and wait for Railway deployment, then hard-refresh the app.

Uses the existing Railway ODDS_API_KEY. Load Player Projections to automatically fetch FanDuel main over/under lines for passing yards/TDs, rushing yards/TDs, receiving yards/TDs and receptions. Refresh FanDuel props checks again (five-minute server cache). Availability depends on the provider and your odds subscription; requests consume odds credits per returned market. No subscription changes are made by this update.

Manual entries are preserved, including saved browser entries; clear a manual entry and click Refresh FanDuel props to use the feed. Automatic quotes are session-only, timestamped, and excluded after 30 minutes when rerendered. Missing, ambiguous, stale and one-sided markets remain manual. Only upcoming games are supported. Exact normalized full player names must be unique within the matchup; no fuzzy player matching. Alternate lines and anytime TD markets are not substituted for stat over/under lines.

Verified locally with mocked provider responses, parsing checks, JavaScript syntax checks and existing model/rankings tests. Live subscription access still needs verification after deployment.

Provider documentation: https://the-odds-api.com/sports-odds-data/betting-markets.html

Rushing attempts now request the documented `player_rush_attempts` market. Running-back receiving yards and receptions use the existing receiving markets, without a position restriction. Availability depends on the bookmaker/feed; absent quotes are not guessed.
