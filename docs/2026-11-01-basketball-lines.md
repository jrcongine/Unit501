# Basketball FanDuel investigation — November 1, 2026

The opt-in production diagnostic on commit d62309a used the existing odds connection without exposing credentials. A persistent exclusive marker limits each explicitly enabled audit ID to one run. It checks free event lists first, requires at least 14 remaining credits, and requests at most one seven-market event per league. There is no periodic polling.

## Live evidence before the fix

At 17:40 UTC, NBA Boston Celtics–Orlando Magic matched uniquely. FanDuel returned moneyline, spread and total, plus all four requested player markets. All 43 candidate prop lines were accepted; none were rejected. For example Anthony Black points was 13.5 at that check. These are transient quotes, not recommendations or guaranteed current prices.

CBB Liberty–High Point failed the ordered-team matcher: ESPN listed Liberty away and High Point home, while the odds source listed the reverse, at the same tipoff. ESPN marked the game neutral at Rock Hill Sports & Event Center. The official High Point schedule independently lists this matchup as Neutral in Rock Hill:
https://highpointpanthers.com/sports/mens-basketball/schedule/2026-27?grid=true
https://highpointpanthers.com/news/2026/8/12/high-point-mens-basketball-releases-2026-27-non-conference-slate.aspx

## Repair

CBB now accepts the exact reversed team pair only when the selected schedule explicitly marks the game neutral. Sport, two distinct team names, tipoff tolerance and unique event identity remain required. The game-market parser receives correctly oriented team labels, preserving actual team-specific spread signs, prices and moneylines. Prop identities still require the exact event ID and matchup. Non-neutral reversed games and ambiguous duplicate events remain rejected.

The diagnostic also exercises the production adapters against its captured live response, without additional paid calls. This verifies parsing and team orientation; it does not by itself constitute browser visual verification or guarantee historical player coverage for every line.
