# NBA home/rest candidate — October 30, 2026

Decision: do not deploy these weights. The candidate does not show convincing improvement over the current recent-five baseline.

Reproduce offline: `node scripts/nba-rest-candidate-audit.js`. Full output is saved in `data/nba-rest-candidate-audit-2026-10-30.json`.

Uses the existing 1,230-game NBA 2024–25 archive. Fit on 432 eligible games before January 1, 2025 UTC, then freeze weights and evaluate 750 later games. Each baseline forecast uses only earlier qualifying results through the production backtest. Rest is home-minus-away full Central calendar days off, capped at three per team. A fixed ridge penalty of 20 shrinks the rest coefficient; no hyperparameter search was performed.

| Candidate | Margin MAE | Winner accuracy | Winner decisions |
|---|---:|---:|---:|
| Production recent-five baseline | 12.037 | 63.84% | 744 |
| Fitted home advantage only | 12.039 | 64.00% | 750 |
| Fitted home advantage + rest | 12.011 | 63.20% | 750 |

The fitted home/rest candidate uses +2.093 home-margin points and +0.971 home-margin points per rest-day advantage. These are research coefficients, not live settings. Winner comparisons have different decision counts because six baseline forecasts tied; they are not betting returns.

Adding home/rest reduced mean absolute margin error by 0.026 points. A seeded 1,000-draw date-block bootstrap gives a 95% interval for candidate-minus-baseline error of -0.178 to +0.140 points; zero remains inside it. Adding rest beyond home advantage alone gives -0.028 points with interval -0.080 to +0.025. Candidate margin error worsened in the first 375 validation games and improved in the latter 375. The direction is not stable enough to justify changing production.

Limitations: this season was already inspected in earlier audits, so the later segment is not independent external validation. Date blocks retain some same-day dependence but not all cross-date team dependence. The archive does not contain historical injury states, actual travel itineraries, odds or player minutes. This experiment does not settle richer rest/travel models or prove rest has no effect. Another season and a prespecified evaluation are needed before promotion.

Validation: targeted tests check training residual fitting, shrinkage, frozen evaluation weights, invalid inputs and winner-tie accounting. No API calls or owner credentials are required.
