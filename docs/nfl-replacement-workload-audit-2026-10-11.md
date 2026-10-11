# Sunday replacement workload audit — October 11, 2026

Read-only audit of all 13 Sunday NFL games using fresh live availability/depth/starter/ownership responses and the saved 32-team pregame player-rating build from the Sunday readiness audit. The 98 unavailable or nonstarter offensive player/team entries include backups; they are not 98 starting-player absences. Conflicting identities are excluded before this stage.

| Outcome | Entries |
| --- | ---: |
| At least one supported workload category | 3 |
| No unique replacement order or reviewed starter | 68 |
| Unresolved lower-depth identity | 2 |
| No eligible roster/availability-matched replacement | 10 |
| Candidates found, but no supported workload category | 15 |

- Saquon Barkley → Will Shipley: estimated, requiring review.
- Tank Bigsby → Will Shipley: estimated, requiring review.
- Michael Pittman Jr. → Germie Bernard: estimated, requiring review.

Supported estimates are conditional transfers of the full absent baseline workload, not forecasts of actual future touches. Previous games can already reflect an absence. No missing workload has been replaced by zero or a league average, and no guard was relaxed.

The app now names each player and category with an unusable profile and explains whether the profile is absent, the latest team game has missing workload, fewer than two paired games exist, coverage is below half, workload is not positive/finite, or efficiency is missing. Diagnostics include the original player and every eligible candidate, preserving committee safeguards and partial category estimates.

Caleb Williams → Tyson Bagent demonstrates the distinction: Bagent's role is confirmed, but Caleb's latest baseline game has no recorded workload. Reassigning older Caleb usage could double-count an absence already reflected in team and player baselines. Kyle Monangai → Roschon Johnson and Lamar Jackson → Tyler Huntley have candidates without paired workload profiles. These remain unknown rather than receiving invented touch counts.

| Original player | Category | Player with missing data | Explanation |
| --- | --- | --- | --- |
| Jalen Nailor | receiving | Jalen Nailor | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Jalen Nailor | receiving | Malik Benson | No paired workload and yardage profile (need at least two recorded games). |
| Breece Hall | rushing | Breece Hall | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Breece Hall | rushing | Isaiah Davis | No paired workload and yardage profile (need at least two recorded games). |
| Breece Hall | rushing | Kene Nwangwu | No paired workload and yardage profile (need at least two recorded games). |
| Breece Hall | receiving | Breece Hall | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Breece Hall | receiving | Isaiah Davis | No paired workload and yardage profile (need at least two recorded games). |
| Breece Hall | receiving | Kene Nwangwu | No paired workload and yardage profile (need at least two recorded games). |
| Adonai Mitchell | receiving | Adonai Mitchell | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Ashton Dulin | receiving | Ashton Dulin | No paired workload and yardage profile (need at least two recorded games). |
| Ashton Dulin | receiving | Deion Burks | No paired workload and yardage profile (need at least two recorded games). |
| Marcus Mariota | passing | Jayden Daniels | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Sam Hartman | passing | Sam Hartman | No paired workload and yardage profile (need at least two recorded games). |
| Sam Hartman | passing | Jayden Daniels | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Athan Kaliakmanis | passing | Athan Kaliakmanis | No paired workload and yardage profile (need at least two recorded games). |
| Athan Kaliakmanis | passing | Jayden Daniels | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Case Keenum | passing | Case Keenum | No paired workload and yardage profile (need at least two recorded games). |
| Miller Moss | passing | Miller Moss | No paired workload and yardage profile (need at least two recorded games). |
| Caleb Williams | passing | Caleb Williams | Latest team game has no recorded workload; the baseline may already reflect the absence. |
| Kyle Monangai | rushing | Roschon Johnson | No paired workload and yardage profile (need at least two recorded games). |
| Kyle Monangai | receiving | Roschon Johnson | No paired workload and yardage profile (need at least two recorded games). |
| Gardner Minshew | passing | Gardner Minshew | No paired workload and yardage profile (need at least two recorded games). |
| Kedon Slovis | passing | Kedon Slovis | No paired workload and yardage profile (need at least two recorded games). |
| Carson Beck | passing | Carson Beck | No paired workload and yardage profile (need at least two recorded games). |
| Lamar Jackson | passing | Tyler Huntley | No paired workload and yardage profile (need at least two recorded games). |

Validation: 194 tests pass; new checks verify separate original/candidate diagnostics, no allocation when both categories are unsupported, conservation of supported rushing shares, and unchanged withholding of unsupported receptions. No projection arithmetic changed. Counts reflect these source snapshots; refreshed roster/status reports may change them.
