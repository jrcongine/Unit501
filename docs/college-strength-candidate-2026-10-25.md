# College opponent-strength candidate — October 25, 2026

## Problem and resulting behavior

The live college index weights season winning percentage and scoring margin.
It can inflate wins over weak schedules and blowouts without evaluating who
was played. This candidate ranks FBS-versus-FBS wins and losses using jointly
estimated opponent strengths. All teams have the same starting assumption;
there are no school, conference, poll or reputation offsets. Winning by 60
instead of 7 does not change the candidate rating.

The model is an original Node implementation of ridge-penalized Bradley–Terry
paired comparisons. It minimizes the binary logistic loss plus half the sum of
squared team strengths (fixed ridge penalty 1). Newton updates use a Cholesky
solve and objective-decreasing step checks; non-convergence withholds the
adjustment. The fixed penalty is an experimental assumption, not a parameter
fitted to 2026 or a proven football optimum. Source background:
https://www.jstatsoft.org/article/view/v048i09 and
https://arxiv.org/abs/2406.09597 . This does not implement the latter paper's
empirical Bayes tuning or claim its validation results for UNIT501.

Displayed index = 100 × logistic(team strength), relative to zero/average
latent strength. It is a descriptive 0–100 index, not a calibrated chance of
winning. Ranking uses the unrounded strengths; indistinguishable strengths
sort by school name. Schedule rank uses the average fitted strength of played
FBS opponents; repeat opponents count per game and equal schedule values share
a schedule rank. Injuries, venue, personnel, score margin and projected future
games are not modeled. This is a results ranking, not an official poll or a
standalone wagering model.

## Input and conservation gates

- Reuse the existing protected API-Sports season schedule, the same metered
  endpoint used by college Game Lab. No per-team or box-score expansion.
- One shared season request per 15-minute college cache, including failed
  attempts; the existing football request-budget guard remains in effect.
  This is additional quota usage when the college panel loads, not an extra
  subscription. Other leagues do not request the college schedule.
- Match the verified 2026 FBS membership and canonical aliases. Only completed
  results with kickoff before the current snapshot are eligible. Duplicate
  identical games are counted once; conflicting duplicates are rejected.
- All 138 teams' completed-game counts, wins, losses and point differentials
  must exactly match their standings snapshot. Partial/paginated/invalid data
  cannot produce an adjusted ranking. Cross-provider timing differences can
  intentionally delay the adjustment until the next cache cycle.
- Each team needs two completed FBS games, and the played FBS graph must be
  connected. Do not present a national ordering across disconnected pools.
- FCS results are counted for overall-record reconciliation but excluded from
  the FBS rating. No assumed FCS quality is invented. The overall record stays
  visible; the FBS-only record and played-schedule rank appear beneath the team.
- If validation fails, preserve the existing record/margin board and clearly
  label it **unadjusted**, with the reason. Headlines remain independent. No
  silent claim that opponent strength was incorporated.

## Validation and limits

All 471 Node tests pass locally. Tests cover equal records against different
opposition, zero-centered strengths, orientation and order invariance, margin
invariance, FCS exclusion, all-138 coverage, future-result exclusion, duplicates,
missing/conflicting results, disconnected schedules, per-user concurrency,
failed-provider conservation, explicit unadjusted fallback, and Game Lab labels.
Local Chromium rendered both the adjusted and fallback views at desktop
1280px and phone 390px widths. Screenshots were inspected; all 138 schedule
labels were present, Top 25 grouping was preserved and no page overflow was
found. Existing football predictions, props, professional boards, NBA markets
and account-related source code are unchanged by this candidate.

Live national college source completeness and current adjusted ranks have NOT
been verified. Public ESPN scoreboard probes returned incomplete 25-game lists
and ignored the tested pagination parameters, so those partial lists are not
used for strength adjustment. No owner's private credential was accessed or
changed, and no live paid-provider request was made while developing this draft.

This is mathematical and integration validation, not a historical predictive
backtest or proof that the candidate outperforms the live index. Earlier saved
forecasts cannot be recreated. The candidate is not merged or deployed. A
release approval is still required. The first private college load will check
current source reconciliation before showing any adjusted board; if it fails,
the application explicitly retains the unadjusted board.
