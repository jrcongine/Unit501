# Roster and injury reports

Upload these files at the repository root, preserving public/ and test/ folders. Commit to main, wait for Railway, then hard refresh.

Selecting a game loads both teams' provider roster and current injury reports using the existing API_SPORTS_KEY. Expand each roster to see names, positions and provider groups. Player projections display matched injury reports and warn when a player is absent from the provider roster. Matching uses player and team IDs.

Fetch timestamps are distinct from injury report dates. Reports older than seven days are labeled for rechecking. Empty reports never imply healthy players. Failed reports and unsupported coverage show unknown. Current injury reports are not fetched for historical seasons. For previous games within the current season these remain explicitly current reports, not historical availability.

This release does not verify trades, starting roles, or game-day inactive lists. For upcoming games within seven days, fresh provider out/inactive/IR reports or a fresh injured-reserve roster entry withhold player projections and line comparisons. Missing, stale, future-dated and conflicting reports remain unknown. Questionable/doubtful reports do not imply a playing probability. The latest dated injury report takes precedence over older reports. Current reports never gate past matchups.

Player cards offer an explicit 0–100% workload scenario. It linearly scales the displayed projection and line comparison, not historical averages or playing probability. Scenarios reset when the matchup changes. Unavailable players are withheld rather than shown as a zero-stat under. Workload scenarios do not redistribute touches or alter team scores. Automatic team-score injury, weather and venue adjustments remain unfinished. Schedule-strength correction is documented in SCHEDULE-STRENGTH.md. Team-season roster membership is provider information, not a confirmed transaction history. Rosters cache one hour; injuries cache 15 minutes; concurrent visitors share requests. Refresh respects those cache windows.

Validation: mocked-provider tests cover team separation, partial failures, unsupported coverage, historical seasons, concurrent request sharing and cache expiry. All 27 Node tests, JavaScript syntax and whitespace checks passed. Seven injury-model tests cover availability gates, team/player separation, freshness, conflicting statuses, historical matchups and workload scenarios. Live provider contents still need verification after deployment.
