# Basketball probability audit and source safeguards — October 30, 2026

Baseline: `b7e37109557e5467abfb7776a0e0ddc6fcec3222`. Reviewed current models and prior home/rest research before changing anything. No earlier completed work was repeated.

## Production fixes

College score estimates and both basketball simulations now reject a team explicitly marked unavailable, even if numeric historical summaries remain attached. College also recognizes the shared missing/conflicting/invalid coverage fields. Both score models reject non-finite computed scores/totals; NBA simulation rejects negative estimate inputs. Valid histories retain the same scoring formulas and defaults.

## Reproducible probability evaluation

Run `node scripts/basketball-probability-diagnostics.js` to reproduce the committed JSON in `data/basketball-probability-audit-2026-10-30.json`. The existing NBA/CBB backtest modules now optionally replay their actual production simulations. Seeds are stable per game. The ordinary score-only output is unchanged.

The audit normalizes home/away simulation frequencies conditional on a non-tied outcome. That conditional quantity is evaluated against the actual winner; it is not a new overtime model or proof that raw tied simulations represent final-game draw risk. All-tied samples cannot create a win probability.

A fixed ridge logistic calibration fits only games whose results were assumed known before January 1, 2025 UTC, then evaluates later games without refitting. The regularization strength is fixed at one, toward intercept=0/slope=1. Brier score and log-loss are proper probability-error scores; lower is better. The audit also provides ten reliability bins with descriptive Wilson intervals and a paired UTC-date-block bootstrap for the Brier difference. Missing and contradictory inputs are excluded or rejected, not silently converted to 50%.

| NBA Season view, 2024–25 | Earlier training | Later evaluation |
|---|---:|---:|
| Eligible games | 400 | 750 |
| Existing conditional Brier score | 0.21654 | 0.22110 |
| Existing conditional log-loss | 0.62253 | 0.63331 |
| Candidate Brier score | — | 0.21341 |
| Candidate log-loss | — | 0.61483 |

The fitted intercept is 0.29274 and slope 1.60067. Later Brier error fell by 0.00770; the descriptive 95% paired date-block interval for candidate minus current is [-0.01261, -0.00314]. This is a promising research result, not a deployment guarantee. Of 1,182 score forecasts, 30 lacked five recent games per side for simulation; two additional games fell across the result-known split boundary and entered neither training nor evaluation. Average simulated tie frequency was 2.41%.

The college archive yields only 26 eligible games between the ten collected teams: two earlier and 24 later. It fails the fixed minimum of 200 training and 200 evaluation games, so no college calibration is fitted.

## Limits and next evidence

- This NBA archive has already been used in prior research. The later sample is chronological but **not an untouched final holdout**. Keep the candidate offline pending independent season/prospective validation. No coefficients are imported by the live scoring models.
- Source schedules contain final scores, not historical publication timestamps. Result availability is conservatively assumed five hours after tipoff. This is retrospective reconstruction, not archived pregame predictions.
- The college sample is selected, not representative. Full-league calibration needs broader verified coverage.
- These archives contain no historical odds, injuries, lineups, player workload or itineraries. They cannot validate betting returns or team injury/rest/travel coefficients. Basketball team injury/replacement effects and opponent-strength improvements remain unfinished.
- Authenticated live-provider acceptance remains blocked by unavailable app/provider credentials. Public server health is not a substitute. No access protections or provider settings changed.

## Verification

850 automated tests pass, including deterministic simulation replay, target/future-outcome isolation, chronological calibration isolation, duplicate conflicts, all-tied/invalid samples, insufficient-sample withholding, unavailable source guards and overflow rejection. `git diff --check` passes. No UI layout change was made.
