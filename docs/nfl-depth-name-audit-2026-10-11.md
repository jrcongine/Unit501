# NFL depth identity audit — October 11, 2026

Replay the 26 Sunday teams' saved live depth reports and rosters from the replacement workload audit through the shared official-report identity matcher. Originally 42 QB/RB/FB/WR/TE depth entries were unresolved. Resolve 21 offensive entries, leaving 21 unresolved. Across all chart positions, 33 entries resolve (12 additional defensive entries).

Reused the verified injury-report aliases and added seven official-source-reviewed depth nicknames in `injury-name-aliases.json`: Hollywood Brown, Cam Ward, Mitchell Trubisky, Mitch Tinsley, Drew Ogletree, Bam Knight and Matt Hibner. The shared implementation in `player-name-match.js` requires unique identities and rejects explicit suffix conflicts. Aliases additionally require team ID, player ID, roster name and position. Offensive chart matches always require the same position, including exact names.

| Chart name | Roster name | Position | Team ID |
| --- | --- | --- | --- |
| Hollywood Brown | Marquise Brown | WR | 12 |
| LeQuint Allen Jr. | LeQuint Allen | RB | 2 |
| Cam Ward | Cameron Ward | QB | 6 |
| Mitchell Trubisky | Mitch Trubisky | QB | 6 |
| Mitch Tinsley | Mitchell Tinsley | WR | 10 |
| Ollie Gordon II | Ollie Gordon | RB | 25 |
| Mike Washington Jr. | Mike Washington | RB | 1 |
| Aaron Jones Sr. | Aaron Jones | RB | 32 |
| Drew Ogletree | Andrew Ogletree | TE | 21 |
| Anthony Richardson Sr. | Anthony Richardson | QB | 21 |
| Cam Skattebo | Cameron Skattebo | RB | 4 |
| Chig Okonkwo | Chigoziem Okonkwo | TE | 18 |
| Marvin Mims Jr. | Marvin Mims | WR | 28 |
| Oronde Gadsden | Oronde Gadsden II | TE | 30 |
| Gardner Minshew II | Gardner Minshew | QB | 11 |
| Bam Knight | Zonovan Knight | RB | 11 |
| Deebo Samuel Sr. | Deebo Samuel | WR | 14 |
| Montorie Foster Jr. | Montorie Foster | WR | 23 |
| Matt Hibner | Matthew Hibner | TE | 5 |
| Kyle Pitts Sr. | Kyle Pitts | TE | 8 |
| Brian Robinson | Brian Robinson Jr. | RB | 8 |

Of the 21 remaining offensive entries, 9 are multi-player shared chart cells. They remain unresolved instead of implying a unique depth order. The other 12 lack a supported roster/position match. Houston's unavailable chart is separate from these counts. No missing roster identity, cross-position match, trade or starter announcement is inferred.

Supported replacement estimates remain 3 before and after this replay. Eagles replacement gaps become availability/eligibility gaps once Hollywood Brown is correctly identified; no blocked player is reinstated. Durham Smythe gains an identified lower-depth candidate, Matthew Hibner, but missing workload coverage still withholds allocation. Existing ownership, availability, profile and confirmation guards remain active.

Validation: 195 tests pass, including existing official injury mapping and replacement guards plus depth alias/suffix matching, conflicting positions, competing exact/alias identities, and unresolved multi-player cells. Chart rank and slot are preserved. Fetch time still does not establish publication time, game starter or future touches. Counts describe the saved audit inputs, not a guarantee of complete current roster coverage.
