# Shared prop feed malformed-record isolation — October 31

Reproduced a shared parser exception: a null bookmaker, market or outcome row could abort the whole player-line response. NFL/CFB and NBA/CBB all use this parser. Independent valid paired quotes now survive malformed siblings. Invalid records never become lines, and duplicate FanDuel books, conflicting snapshots, stale timestamps, invalid prices and unpaired outcomes remain rejected.

The response audit adds malformedRecords counters for bookmaker, market and outcome records. These are distinct from player/market quote candidates; accepted + rejected still equals quotesReceived. Returned market keys remain recorded even when their outcome container is invalid. Explicit supported-market membership prevents inherited object-property names from being accepted as markets.

Two new crash regressions failed before the repair. Final full suite: 905 tests passed, including football and basketball parser wrappers, original provider timestamps, shared line-history propagation, ambiguous/duplicate rejection, unsupported markets and request/client regressions. No UI, provider subscription, credentials or additional paid requests changed.

This proves recovery from malformed response siblings, not that malformed data caused any particular missing live FanDuel line. Complete provider-versus-sportsbook coverage and protected live matchup acceptance remain unverified. Source coverage cannot be filled by inventing quotes.
