# Basketball historical absence adjustment

NBA and CBB share `public/basketball-injury-model.js`. Team scores and their simulations use the same adjusted estimate. This is an experimental conditional historical comparison, not a calibrated causal injury model or a validated betting edge.

Requirements: a current future matchup, fresh matched team and player histories, available team injury reports, unique player matches, and confirmed Out statuses. Conditional statuses withhold the team's adjustment. The selected scoring view must contain 6–10 complete games, reconcile to the displayed scoring averages, and include at least three games with every currently listed Out player explicitly absent and three with them all explicitly playing. Missing records never imply DNP. Simultaneous absences form one joint pattern; player effects are not added individually.

For each eligible team, replace its selected-window scoring/allowance average contributions with the corresponding absence-pattern averages. Each contribution has half weight, matching the existing team projection formulas. This shifts from the actual baseline, which can already contain absences. A contribution over 10 points is withheld as a quality guard, not clipped into an accepted estimate. Opponent strength, other lineup changes and historical DNP reasons can confound these associations.

The normal baseline remains when evidence is insufficient. This includes long season views without complete matching participation history and short five-game views. UI explanations show applied players, sample counts, point changes and withheld reasons. Fresh report/history expiry restores baseline. Replacement minutes are not inferred.

Validation: synthetic NBA/CBB fixtures prove changes reach simulations, multiple absences do not double count, and wrong/stale/ambiguous/conflicting evidence cannot move scores. Browser-flow tests verify actual display updates and stale-data withdrawal. These tests do not establish historical prediction accuracy or prove that a live matchup has sufficient evidence.

Remaining system-wide gaps: unresolved football roster identities, unsupported blocking/depth evidence and defensive participation, uncalibrated football role thresholds, broader source coverage, and historical calibration of basketball absence adjustments. No player-specific override was added.
