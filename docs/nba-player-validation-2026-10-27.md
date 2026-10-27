# NBA player estimate replay — October 27, 2026

The current NBA player estimator was replayed on two consecutive late-season slices of ESPN box scores. It uses only the ten most recent completed team games at least five hours before the selected game's tipoff and each player's recorded appearances. Box scores and both team identities were checked against final results. The comparison is the unweighted average of the same appearances. MAE is average absolute error, with lower values better.

| Season | Games | Verified team-games | Player samples per stat | Points MAE | Rebounds MAE | Assists MAE | Threes MAE |
|---|---:|---:|---:|---:|---:|---:|
| 2024–25 | 24 | 48 | 485 | 4.77 | 2.06 | 1.38 | 0.99 |
| 2025–26 | 12 | 23 | 234 | 4.67 | 1.83 | 1.50 | 0.89 |

For the same samples, recent-average MAE was respectively 4.73 / 2.06 / 1.40 / 0.98 and 4.62 / 1.82 / 1.52 / 0.89. The differences are small and these slices are not enough to establish a model improvement. No weights or prediction claims were changed.

These samples include only players who appeared in the selected game and had matching earlier history; the model was not tested on predicting whether a player would play or on the full pool of available prop lines. No historical injury reports, book lines, profitability, or calibration were checked. The replay is a limited research sample, not a betting record or a validation of automated injury replacements. One team-game in the second slice was skipped because its full history could not be verified; other teams continued. The five-hour finish cutoff is an assumption.

Reproduce with `node nba-collect-history.js 2024 2 games.json` and `node nba-player-backtest.js games.json 24`; the second run used season 2025 and 12 games. The replay makes bounded public-source requests and never uses paid NBA credits. GitHub Actions runs 40575728998 and 40575635210 recorded the results. NBA remains beta.
