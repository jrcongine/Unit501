# Remaining NFL depth and workload audit — October 11, 2026

Refreshed availability for the 12 upcoming Sunday games (24 teams). The London game had already started and is excluded. Replayed source entries through the shared identity matcher with three additional reviewed aliases:

| Official chart name | Provider roster name | Team | Player ID | Position / number |
| --- | --- | --- | --- | --- |
| KC Concepcion Jr. | Kevin Concepcion | Cleveland | 39201 | WR / 1 |
| Jacory Croskey-Merritt | Jacory Merritt | Washington | 27317 | RB / 22 |
| Reggie Virgil | Reginald Virgil | Arizona | 16854 | WR / 82 |

Official team biographies agree with each unique provider entry on team, position and jersey number. NC State's December 2023 award announcement additionally identifies Kevin as KC. Aliases remain scoped to exact team, player ID, provider name and position; competing identities are rejected.

Unresolved offensive depth entries fall from 19 to 16 across this refreshed pregame slate. Seven are shared multi-player cells; nine are missing roster entries or position conflicts. Houston's Dare Ogunbowale remains unresolved. Darius Slayton is present on another team's provider roster, so the Indianapolis depth entry is not mapped across teams. Michael Burton and Jackson Meeks retain RB/FB and TE/WR position conflicts. No roster row, transfer or depth order is invented.

Jacory's official weekly injury entry also now maps, reducing unmatched weekly-report rows from 65 to 64. Its game status is blank, which does not confirm participation. All 62 mapped official Out/Inactive entries remain subject to existing availability gates.

Rebuilt player profiles using all 32 NFL teams and 65 completed regular-season games before the noon Central kickoff (97 source reads). Replayed replacement recommendations for 94 unavailable/nonstarter offensive player/team entries, including backups:

| Outcome | Entries |
| --- | ---: |
| No unique replacement order or reviewed starter | 64 |
| Candidates present, paired workload coverage incomplete | 22 |
| No eligible matching replacement | 7 |
| At least one supported workload category | 1 |

Michael Pittman Jr. to Germie Bernard is the one conditional estimate. Last night's two Eagles estimates are excluded here because their game has started. The three new identity mappings do not justify new touch estimates. Missing usage remains unknown; confirmation of Huntley's starting role does not supply a paired workload profile. These estimates transfer an absent baseline workload conditionally and are not calibrated future touches.

Sources:
- https://www.clevelandbrowns.com/team/players-roster/kc-concepcion/
- https://gopack.com/news/2023/11/30/football-kc-concepcion-announced-as-shaun-alexander-freshman-of-the-year-award-finalist
- https://www.commanders.com/team/players-roster/jacory-croskey-merritt/
- https://www.azcardinals.com/team/players-roster/reggie-virgil/
- https://www.nfl.com/injuries/league/2026/reg5

Validation: 201 tests pass. Added checks for each new alias, wrong team, wrong player ID, wrong position and a competing exact name. Existing depth ambiguity, workload coverage and availability checks continue to pass. Counts describe refreshed source snapshots, not complete game-day inactive lists or validated injury prediction accuracy.
