# Season progression foundation

Player projections now load all completed pre-kickoff games returned for the selected teams' season, excluding preseason and exhibition games. There is no four-game cutoff. Only recorded stats count; missing player rows/statistics are not inferred as zero or as proof of participation. The provider's schedule completeness has not been independently verified.

Each prop baseline blends 50% recorded season average with 50% exponentially weighted recent form, with weights halving every three recorded team games in that player's history. This is an explicit, uncalibrated assumption. Existing matchup yardage adjustments and explicit workload scenarios then apply. Historical comparisons use all recorded season values and remain historical frequencies, not probabilities. Cards show the sample size and a recent-three-versus-earlier trend when at least two earlier records exist.

This is a foundation for position-specific player ratings, not an overall talent grade. Only existing passing, rushing and receiving props use it. A separate experimental NFL production-rating panel is documented in PLAYER-RATINGS.md. Blocking and detailed coverage ratings, full roster participation, historical opponent adjustment, automatic injury valuation and team-score integration remain unfinished. Full-season player box scores require more requests than the previous four-game window; live quota and response coverage need verification.

## October 10 projection audit

Yardage now uses season/recent workload × blended pooled/median efficiency when at least two paired usage records exist; otherwise it retains the season/form yardage baseline. Rush attempts are a separate market. Negative recorded yardage remains valid. Opponent adjustments use completed league and opposing team defensive totals of the same metric. Team histories no longer merge across a trade; saved browser lines retain their original player-ID keys. See FOOTBALL-AUDIT.md for live-data limits and tests.

## Historical range coverage

Player cards now replay the historical-error range against later recorded outcomes. Each evaluated range requires at least ten earlier baseline replay errors, all starting more than 24 hours before that evaluated game. The selected matchup and later results are excluded. The calculation uses the same 10th–90th percentile residual bounds as the displayed range, retains negative yardage and floors count-stat bounds at zero. It reports inside/below/above counts and average width; fewer than 30 evaluated outcomes is explicitly limited evidence. Missing, duplicate and withheld outcomes never become zeros. The observed fraction inside is not a calibrated prop probability, and the check excludes matchup, injury and workload adjustments.

## Efficiency outlier damping (player-form-v2)

With at least four paired yardage/workload records, the pooled efficiency component caps high game efficiencies at the median plus the greater of three scaled median absolute deviations (3 × 1.4826 × MAD), half the absolute median, or one yard per usage. The typical-efficiency median and 50/50 pooled/median blend remain. Workload and actual historical statistics remain unchanged; negative yardage remains valid. Fewer than four paired records retain the previous estimate. Cards disclose when the cap affects a game. This is an explicit uncalibrated heuristic, not demonstrated accuracy improvement. Chronological player backtests use the updated production formula using only prior records. New archived props have a distinct v2 model label; old forecasts are never rewritten.
