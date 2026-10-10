# Season progression foundation

Player projections now load all completed pre-kickoff games returned for the selected teams' season, excluding preseason and exhibition games. There is no four-game cutoff. Only recorded stats count; missing player rows/statistics are not inferred as zero or as proof of participation. The provider's schedule completeness has not been independently verified.

Each prop baseline blends 50% recorded season average with 50% exponentially weighted recent form, with weights halving every three recorded team games in that player's history. This is an explicit, uncalibrated assumption. Existing matchup yardage adjustments and explicit workload scenarios then apply. Historical comparisons use all recorded season values and remain historical frequencies, not probabilities. Cards show the sample size and a recent-three-versus-earlier trend when at least two earlier records exist.

This is a foundation for position-specific player ratings, not an overall talent grade. Only existing passing, rushing and receiving props use it. A separate experimental NFL production-rating panel is documented in PLAYER-RATINGS.md. Blocking and detailed coverage ratings, full roster participation, historical opponent adjustment, automatic injury valuation and team-score integration remain unfinished. Full-season player box scores require more requests than the previous four-game window; live quota and response coverage need verification.

## October 10 projection audit

Yardage now uses season/recent workload × blended pooled/median efficiency when at least two paired usage records exist; otherwise it retains the season/form yardage baseline. Rush attempts are a separate market. Negative recorded yardage remains valid. Opponent adjustments use completed league and opposing team defensive totals of the same metric. Team histories no longer merge across a trade; saved browser lines retain their original player-ID keys. See FOOTBALL-AUDIT.md for live-data limits and tests.
