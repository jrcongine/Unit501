# Injury and replacement forecast comparison

As of October 11, 2026, no eligible historical archive is committed. Injury and replacement adjustments remain experimentally unvalidated. Existing score replays and player baseline checks do not measure these adjustments.

`node injury-backtest.js archive.json` compares baseline and adjusted forecasts archived together before kickoff with recorded final outcomes. It does not reconstruct injury history, generate projections, or prove that the live adjustment formula improves accuracy. No runtime behavior changes or automatic activation follow from its output.

Each JSON array record requires:

| Field | Meaning |
| --- | --- |
| league, season, gameId, teamId | Exact league, season, game and team identity |
| kind, market | `score` / `points`, or `prop` / one supported player market |
| playerId | Required for props; exact player identity |
| modelVersion | One fixed model revision per comparison; mixed revisions are rejected |
| evidenceUrl | HTTPS source for independently reviewed pregame evidence |
| kickoff, forecastAt, inputAsOf, resultKnownAt | Unix milliseconds; inputs known by forecast, forecast strictly before kickoff, final outcome known after kickoff |
| baseline, adjusted, actual | Finite values for the same target and units |

The two forecasts must use the same scoring/player baseline, weather, matchup and market. Their only intended difference is the injury/replacement scenario. Preserve the original forecasts and source snapshots before kickoff; adding timestamp fields afterward does not establish an archive. Review those files independently: the comparison tool checks assertions, not their authenticity or whether all source evidence existed at that time. Use a confirmed final result, not an in-progress value. An omitted appearance is missing, not zero.

Duplicate targets are all rejected, including equivalent numeric/string IDs. Invalid or late inputs are counted as skips. NFL and college results stay separate. Props stay separate by market; receptions and yards are never averaged together. Within each group, mean absolute errors receive equal weight per game so games with more player targets cannot dominate. Both forecasts use the same accepted pairs.

Fewer than 30 distinct games per league/market produces `insufficient`. At 30 games, `lower-observed-error` is only a descriptive result for that sample. It is not statistical significance, independent future validation, a causal estimate, a sportsbook edge, or evidence for automatic activation. Sampling must include all archived eligible forecasts, including failures; selective reporting invalidates the inference.

Next data requirement: retain original pregame forecasts, the reviewed scenarios and their complete input/source snapshots, then match confirmed final results. Current provider injury lists and current roster/depth pages must never substitute for historical game-day records.

## Pregame capture in Game Lab

Game Lab now saves the first successful upcoming simulation per game with an applied manual injury or lineup score adjustment to this browser's local storage. Later revisions do not replace that first forecast. It captures the scoring context, forecast, manual settings, available roster/injury/depth reports, reviewed lineup scenarios and player rating inputs. Baseline and adjusted projections share the same calculation timestamp, weather, venue, matchup and non-injury point adjustments; baseline disables manual injury and lineup effects only. No player prop forecasts are captured in this version.

The status message states whether saving succeeded. Storage errors leave existing records intact. The archive is device-local, not a server collection service. Use **Download saved score forecasts** for a JSON backup. Browser data clearing can erase local records. A first forecast remains archived even if later inputs are better; future testing must follow this fixed selection rule. New scoring or lineup algorithm revisions must update the capture model-version label.

The exported schema-1 bundle is accepted by the comparison command. Pending records have `actual` and `resultKnownAt` null and are excluded until confirmed final results are attached to a separate copy. Preserve the original export. Its `evidenceUrl` identifies the forecast application; original report URLs and the captured data are inside each snapshot's inputs. The live application URL alone does not authenticate historical injury evidence. Pregame device-clock timestamps remain assertions, not independently timestamped archives. Comparing these records measures user-reviewed scenario forecasts, not the causal effect of an injury or an automated injury prediction.
