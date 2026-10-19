# Unit 501: one product, separate sport engines

## Agreement
NBA should have the same familiar user journey as football: select league and date -> game slate -> Game Lab -> market and player views -> save pregame forecasts -> compare results -> War Room. Reuse shared infrastructure and presentation, but **do not** copy football's point distributions, injury values, time horizons or position-based props into basketball.

## Shared infrastructure: change it once for both sports
- `public/unit501-shared-ui.js`: Central date/time display, keyboard-accessible game cards, matchup labels and slate-to-Game-Lab selection. Both football and the NBA beta call this module.
- Common UI styling: same header, cards, responsive slate, Game Lab hierarchy and disabled/unavailable messaging.
- Upcoming shared service layer (not yet implemented): provider-independent game normalization, line/price verification, audit record identity, immutable pregame snapshot policy, result grading, calibration plots, reproducible testing and source availability.
- Shared War Room **principles**: externally published picks must be attributed, dated, price-checked and graded as independent handicapper/market selections. NBA is not in the automatic source registry yet, and the NBA beta does not claim it is.

## Sport-specific adapters: never assume football and NBA behave alike

| Capability | Football now | NBA beta now | NBA implementation gate |
| --- | --- | --- | --- |
| Schedule/game IDs/results | Live football provider | Separate API-NBA adapter and schedule | Confirm Railway NBA API plan and live game shapes |
| Team scoring history | Existing football ranks | Pregame same-stage season/last-10/last-5 scoring, no projection | Confirm provider history completeness and current team IDs |
| Score projections | Football team scoring engine | **Disabled** | Per-possession ratings, pace, rest, schedule and defense |
| Spread/total odds | Existing football FanDuel matching | **Disabled** | Verified NBA market mapping and timestamps |
| Availability | Football injury/lineup scoring | **Disabled** | Confirmed NBA starters, minutes restrictions, rotations |
| Player props | Football position-specific estimates | **Disabled** | Minutes + usage and points/rebounds/assists/3PM model |
| Monte Carlo probabilities | Football score-based sim | **Disabled** | Basketball distribution and variance calibration |
| Forecast archive and report card | Football browser-local archive | **Disabled** | Sport-keyed pregame snapshots, no post-tipoff backfill |
| War Room | NFL/college football/MLB published picks | **Not NBA-enabled** | Attributable, dated NBA picks from proven feeds |

## Rules for future work
1. Make a shared UX, audit, serialization or error-handling improvement in one common module and regression-test **both** football and NBA call sites.
2. Put league-specific stats, prop definitions, odds mapping, injury effects, minutes and simulator math behind a named sport adapter.
3. Any feature lacking verified inputs must show `Unavailable`, not a simulated number or a duplicated football assumption.
4. Forecasts must be written **before tipoff** with model version, market, exact line/price and immutable input timestamp. Grade only later; don't reconstruct past predictions.
5. NBA simulation can launch as an experiment only after the real schedule, historical NBA box scores and team-rating coverage are verified. Track scored holdout games before promoting confidence estimates.
6. Do not silently alter the existing football model, archive key, Big 12 picks, or sportsbook data while building NBA.

## Next milestone
After the NBA data subscription is confirmed, populate selected-game team context (last 10, season offense/defense, pace, rest and schedule strength) from real NBA box scores, display data coverage, and build a separately versioned basketball score model. Only then enable estimates and downstream prop labs.
