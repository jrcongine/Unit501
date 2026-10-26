# UNIT501 work queue — October 25, 2026

Continue the existing application and preserve its features and data.

1. Finish PR #142: embedded five-league rankings/headlines, Top 10/middle/bottom,
   ascending/declining/steady indicators, selected-team Game Lab context.
   Source permissions/commercial suitability and release review remain open.
   Current arrows measure win/loss streak form, not week-to-week rank movement.
2. NFL Game Lab: new starters, increased usage/primary options; projection
   controls above projections; injury and matchup adjustments. Confirm live
   behavior before treating earlier implementation as complete.
3. NBA: team spreads/totals/scores, player minutes/usage/props, sportsbook
   comparison and reliability comparable to football.
4. App cleanup: mobile/desktop, navigation and broken screens, data freshness
   and projections. Preserve existing code, features and database.
5. Selling: accounts/recovery, account-scoped browser data, subscriptions,
   iPhone/Android direction, November beta during football season. Account
   work also exists separately in draft PR #138; do not overwrite it.
6. Upset audit: clear outright underdog picks versus cover-only projections;
   evaluate genuine saved pregame forecasts against results and captured lines.

## Changes prepared in this session

- Explicit projected outright winner and underdog outcome in football Game Lab.
- Both-team simulated win frequencies with tied-score treatment explained.
- Rename misleading manual “Upset” margin control; model formula unchanged.
- Saved upset-history summary grouped by league, season and model version.
  It uses existing browser archives and matched outcomes; no season history
  reconstructed and no extra paid provider polling.
- Withdraw stale Game Lab power ranks when the selected league refreshes/fails.
- Regression tests cover both underdog sides, cover-only cases, score ties,
  pick’em/push cases, archive validation and provider refresh failures.

These changes are draft work. Do not describe them as deployed until verified
in production. No claim about the user's lifetime upset record is supported
without access to their saved browser forecasts.

## NFL follow-up

The draft already places selected-player controls above the comparison table
and flags manual role reviews, current starter evidence, observed usage
increases and supported same-position absence opportunities. Workload scenarios
previously only reduced the baseline. Added explicit 125%, 150% and 200%
manual larger-role choices, with individual-player scope, matchup reset and
warnings about overlapping confirmed replacement transfers. They do not
automatically change a player's role or team scores.
