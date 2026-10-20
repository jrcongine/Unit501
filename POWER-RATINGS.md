# 501 Power Ratings — research display (draft PR #124)

## Included
Once a football matchup's existing /api/rankings pre-kickoff snapshot is ready, select 501 Power Ratings to view:
- The full 32-team NFL or verified 138-team FBS league, sorted by rating in points above/below a league-average team on a neutral field.
- Overall relative 1–10 rank and six relative category grades: scoring offense, scoring defense, passing offense, rushing offense, pass defense, run defense.
- Two distinct scouting panels for strengths (up to two grades of 7–10) and weaknesses (up to two grades of 1–4), or neutral messages where categories do not qualify.
- Matchup side-by-side panels plus the neutral-field difference and a clickable full-league table with team detail.

## Methodology and availability
Use the existing completed-before-kickoff league snapshot. No new sports API requests.

The baseline is game-weighted league points scored AND allowed divided by two.
Offensive points = (team points scored/game - baseline + eligible schedule offense correction) x games/(games+4).
Defensive points = (baseline - team points allowed/game - eligible schedule defense correction) x games/(games+4).
Overall power rating = offensive points + defensive points.

Four pseudo-games of smoothing are heuristic. The schedule correction uses a leave-head-to-head-out opponent average with four baseline pseudo-games, a 0.5 factor and +/-6 point cap. Apply schedule corrections to EVERY team only if ALL teams have verified complete opponent schedules; otherwise NO team's power rating receives them. This avoids mixing unequal rating bases. Category grade = round(1+9*(pool-rank)/(pool-1)), clamped to 1–10. A smaller points/yardage allowed metric is a stronger defensive rank. Tied metric ranks may share grades.

Do not invent 1–10 grades from incomplete data: yardage box scores are capped to conserve the API quota, so missing league coverage displays a dash. Incomplete league scoring pools and wrong matchup/season cutoff withhold the board. Small samples are volatile.

## Prediction integration and remaining work
This is a read-only diagnostic: existing scoring-v2 already consumes scoring offense, defense and schedule strength. Do NOT add the rating difference again, as that double counts the same evidence. The rating differential appears alongside matchups for human comparison; simulation scores, props, probability calibration, injury adjustments and optional Prime-Time/Sunday Upset scenarios remain unchanged.

Before allowing a separate power-based score scenario, run historical chronological head-to-head replay against scoring-v2 and validate better held-out margin/score/total error AND win/cover/over reliability. Ratings are not a guarantee or an independent sportsbook edge. These are population-relative grades rather than athlete talent assessments. QB, injuries, special teams and line play are withheld until trustworthy independent data exists.

NBA beta cannot yet support a comparable verified full-league box-score ranking pipeline. Port this feature to NBA only after that coverage exists.

## Verification
npm test includes the new power-ratings model tests and existing scoring regressions. Verify the UI manually in staging on mobile and desktop before deployment.
