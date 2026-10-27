# NBA scoring replay — October 27, 2026

The existing NBA scoring model was replayed chronologically using ESPN public team schedules, collecting each matchup from both teams. Inputs for each matchup contain only same-season, same-stage games that ended before tipoff (or, when no end time was available, tipped off more than five hours earlier). At least three earlier results per team are required. The first games and incomplete or unscorable records are excluded. Model ties are excluded from winner accuracy.

| Season | Evaluated | Window | Winner accuracy | Team score MAE | Total MAE | Margin MAE |
|---|---:|---|---:|---:|---:|---:|
| 2023–24 | 1,183 | Last 5 | 61.1% | 9.62 | 14.99 | 11.79 |
| 2023–24 | 1,183 | Season | 64.4% | 9.62 | 15.18 | 11.49 |
| 2024–25 | 1,183 | Last 5 | 63.3% | 9.72 | 15.35 | 11.67 |
| 2024–25 | 1,183 | Season | 65.4% | 9.50 | 15.05 | 11.47 |
| 2025–26 | 1,183 | Last 5 | 63.2% | 9.99 | 15.66 | 12.20 |
| 2025–26 | 1,183 | Season | 67.5% | 9.80 | 15.46 | 11.90 |

MAE is average absolute error in points; lower is better. Winner denominators vary slightly because projected ties are omitted. These seasons were used to select the new Season default and are not an independent test of that selection. The last-five and venue views remain selectable. This replay uses final scores including overtime and does not reconstruct historical injuries, player lineups, odds, market prices, or data availability timestamps. It does not validate betting profitability, player props, win probabilities or simulations. The five-hour completion fallback is an assumption. NBA stays in beta.

Collector fix: ESPN's top-level schedule metadata can report the current season even for an earlier requested season. Each returned event's season, stage and team identities are checked instead, and the 30 schedules must contain matching copies of each game. Results came from GitHub Actions runs 40573847460, 40573542437 and 40573690007 respectively. No paid NBA feed was used.
