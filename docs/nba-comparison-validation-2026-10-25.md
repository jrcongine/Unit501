# NBA moneyline and sportsbook comparison — October 25, 2026

Prepared as a separate branch from current main, independent of PR #142 and the
account draft. Default NBA calls and football predictions are unchanged.

The comparison button loads FanDuel, DraftKings and BetMGM moneylines, spreads
and totals using one on-demand league odds request. The endpoint verifies the
selected slate, source identity, ordered teams and tipoff before returning any
markets. Each bookmaker must have a unique entry; each market must have one
consistent pair of outcomes and valid American prices. Moneylines with a draw,
duplicated team outcomes or mismatched team names are withheld.

The response cache lasts five minutes. Source quotes older than 30 minutes or
past tipoff disappear locally, without polling the paid provider. Failed refreshes
retain only still-fresh quotes. Old matchup requests cannot populate the new
selection. Missing books and markets remain explicit.

Validation: 448 Node tests passed across this independent main-based branch;
17 focused NBA odds/client checks passed. Headless Chromium fixture checks
loaded the actual application HTML, CSS and scripts at 1280px and 390px widths.
The comparison rendered with no page-level horizontal overflow; its table
scrolls within its panel. Screenshots were inspected and timestamps compacted
after the first pass. All fixture game names, prices and data are examples,
not live sportsbook coverage. No live paid-provider request was made.

Authenticated production visuals and actual bookmaker coverage remain
unverified. The existing private service is healthy and has not been changed
by this draft. Merge/release still requires the owner approval requested after
automatic review blocked PR #142's production-triggering merge.
