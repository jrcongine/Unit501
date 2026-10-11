# NFL injury-name audit — October 11, 2026

Compared the official NFL Week 5 report against the 26 Sunday team rosters saved in the Sunday readiness audit. The original exact-name match left 82 rows unresolved. Four suffix omissions and seven reviewed, player-specific aliases resolve 11 rows, leaving 71 unresolved with these same inputs. Five newly mapped rows carry Out status. These are identity corrections, not new injury announcements.

| Team | Official name | Roster name | Status |
| --- | --- | --- | --- |
| Jacksonville Jaguars | LeQuint Allen Jr. | LeQuint Allen | Blank (participation unknown) |
| Miami Dolphins | Rob Beal Jr. | Robert Beal Jr. | Out |
| Las Vegas Raiders | Foley Fatukasi | Folorunso Fatukasi | Blank (participation unknown) |
| Minnesota Vikings | Ben Yurosek | Benjamin Yurosek | Questionable |
| Cleveland Browns | Mike Hall Jr. | Michael Hall Jr. | Out |
| New York Jets | Jarvis Brownlee Jr. | Jarvis Brownlee | Blank (participation unknown) |
| Pittsburgh Steelers | Michael Pittman | Michael Pittman Jr. | Out |
| New York Giants | Cam Skattebo | Cameron Skattebo | Blank (participation unknown) |
| Washington Commanders | Chig Okonkwo | Chigoziem Okonkwo | Blank (participation unknown) |
| Green Bay Packers | Chris Brooks | Christopher Brooks | Out |
| Los Angeles Chargers | Derwin James | Derwin James Jr. | Out |

The seven reviewed aliases and official source URLs are recorded in `injury-name-aliases.json`. They require the exact team ID, player ID, roster name and position. Terminal Jr/Sr/II/III/IV/V omissions require a unique base name and the same position; conflicting explicit suffixes remain unresolved. Any second matching name blocks resolution, including an exact-name candidate competing with an alias or suffix candidate. Existing league-wide roster ownership guards still apply after mapping.

No fuzzy edit-distance, initials, surname-only or general nickname rules were introduced. Missing roster entries remain unknown. Lorenzo Styles Jr. / Lorenzo Styles remains unresolved because CB and S disagree; Michael Reid / Mike Reid also has a position mismatch and no reviewed alias. Jaylon Jones is not Jarrian Jones. Report blanks do not establish participation or starter status.

Validation: 192 tests pass, including suffix collisions, conflicting suffixes, position mismatches, wrong team/ID/name, competing alias identities, and an end-to-end official Out mapping reaching the availability gate. Audit counts describe saved roster inputs and the fetched weekly report, not complete roster accuracy or predictive performance.
