# Roster and injury reports

Upload these files at the repository root, preserving public/ and test/ folders. Commit to main, wait for Railway, then hard refresh.

Selecting a game loads both teams' provider roster and current injury reports using the existing API_SPORTS_KEY. Expand each roster to see names, positions and provider groups. Player projections display matched injury reports and warn when a player is absent from the provider roster. Matching uses player and team IDs.

Fetch timestamps are distinct from injury report dates. Reports older than seven days are labeled for rechecking. Empty reports never imply healthy players. Failed reports and unsupported coverage show unknown. Current injury reports are not fetched for historical seasons. For previous games within the current season these remain explicitly current reports, not historical availability.

This release does not verify trades, starting roles, or game-day inactive lists; it does not adjust projections or remove players. Team-season roster membership is provider information, not a confirmed transaction history. Rosters cache one hour; injuries cache 15 minutes; concurrent visitors share requests. Refresh respects those cache windows.

Validation: mocked-provider tests cover team separation, partial failures, unsupported coverage, historical seasons, concurrent request sharing and cache expiry. JavaScript syntax and whitespace checks passed. Live report contents and UI still need verification after deployment.
