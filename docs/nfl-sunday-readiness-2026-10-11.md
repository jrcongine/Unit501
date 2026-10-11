# NFL Sunday readiness audit — October 11, 2026

Audit timestamp: 2026-10-11T04:41:26.993Z. Target slate: October 11 in America/Chicago. Read-only deployed API-Sports inputs; no bookmaker selections or profit validation.

## Scope and findings

- All 13 scheduled games and 2032 player/team roster entries reviewed.
- All 13 exact-kickoff scoring snapshots completed; baseline scores were finite. Weather adjustments and manual rating/injury scenarios were disabled for these checks.
- Full current NFL player-rating roster build contained 64 player IDs listed on multiple teams. Applying the new league ownership guard to the captured availability inputs withheld 99 additional player/team entries that the matchup-only guard left unblocked. These are provider conflicts, not inferred trades.
- With the guard applied, 338 entries were blocked by unavailable, nonstarter, membership or conflict states. No matched official Out/Inactive player remained unblocked.
- 2 supported offensive absence rows had an estimated replacement proposal; 94 others remained unknown. Tested proposals contained no blocked replacement and no category allocation over 100%; their scenario arithmetic was finite.
- Official status pages verified for all 26 teams after one Raiders–Patriots retry. 82 official rows did not uniquely match the roster and therefore were not assigned to player IDs. This is incomplete coverage, not evidence that those players are healthy.
- Houston had no usable depth chart; 25 of the 26 team depth reports were usable. Reviewed announcements and recent production do not guarantee starting role or future workload.

## Baseline score checks

| Game | Away | Home | Newly blocked ownership entries |
| --- | ---: | ---: | ---: |
| Philadelphia Eagles at Jacksonville Jaguars | 16.1 | 25.2 | 7 |
| Houston Texans at Tennessee Titans | 19.6 | 20.8 | 7 |
| Cincinnati Bengals at Miami Dolphins | 24.5 | 16.9 | 10 |
| Las Vegas Raiders at New England Patriots | 23.3 | 19.0 | 12 |
| Minnesota Vikings at New Orleans Saints | 25.4 | 20.5 | 7 |
| Cleveland Browns at New York Jets | 20.8 | 21.1 | 9 |
| Indianapolis Colts at Pittsburgh Steelers | 22.6 | 23.4 | 8 |
| New York Giants at Washington Commanders | 25.2 | 20.9 | 9 |
| Chicago Bears at Green Bay Packers | 28.0 | 17.4 | 7 |
| Denver Broncos at Los Angeles Chargers | 21.7 | 20.3 | 6 |
| Detroit Lions at Arizona Cardinals | 29.4 | 26.9 | 5 |
| San Francisco 49ers at Seattle Seahawks | 23.8 | 22.2 | 9 |
| Baltimore Ravens at Atlanta Falcons | 25.6 | 23.5 | 3 |

## Implementation and limits

The fix reads a verified 32-team current regular-season schedule pool and checks fresh provider rosters across the league. Reads share the availability cache and run with four workers. Fresh positive duplicate ownership evidence blocks props and replacement eligibility even when the other team is outside the matchup. Partial roster checks preserve detected conflicts but explicitly report incomplete coverage. Provider source failures remain unknown; no team assignment is guessed.

The counts above are a dry run with ownership derived from the separate full-league player-rating build. The new API ownership collector is checked separately after deployment. This audit checks application gates and arithmetic, not prediction accuracy. Actual prop projections depend on recorded history, workload and scenario review; unmatched injury names and unsupported replacement profiles remain gaps. Historical injury/replacement effectiveness still requires future archived forecasts and final results.

Validation: 190 automated tests pass, including complete/partial league checks, concurrent cache sharing, cross-matchup conflicts, and stale/future/wrong-season evidence guards.
