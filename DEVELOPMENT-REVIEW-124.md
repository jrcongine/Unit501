# Draft PR 124 review — October 19, 2026

## Completed

Baseline: 389 Node tests passed. Added quota/caching boundary tests, NBA research
coverage tests and subscription-boundary tests. Final suite: 398 passing tests.

- Football quota: stale previous-day responses cannot exhaust today's quota or
  inflate today's failure count. Pending requests reserve observed quota capacity.
- Football cache: equivalent query ordering shares calls; pending requests survive
  TTL expiry and successful cache lifetime starts at completion. Failed/empty/
  paginated responses remain uncached. No football model/forecast changes.
- NBA: venue splits, recent results and Central-calendar back-to-back/days-off
  context from existing history calls. Future, wrong-stage and unfinished games
  remain excluded. Rest describes returned history, not guaranteed full coverage.
  Schedule pagination is rejected; schedule/history memory caches are bounded.
- Pro: $5.99 monthly catalog, disabled verification boundary and StoreKit scaffold.
  Tests use mock verifier outputs; no real Apple signature verification is claimed.

## Operational evidence and limits

Railway production checked: Unit501 online, one running replica, no recent failures,
no pending changes; successful deployment c7bc5199-9368-463f-92b5-47942d880d77.
No deployment or merge performed by this review. Production has no attached volume.

Provider headers are documented by API-Sports; tests exercise header fixtures.
No live paid-provider request was made in this review. NBA account entitlement and
actual football response headers still need a controlled owner smoke test.
Quota observations/caches remain process-local, reset on restart and do not reserve
across other clients/replicas. They cannot recover quota already spent. Minute quota
is displayed but does not yet implement request pacing. Shared durable quota control
and provider-error cooldowns are required before multi-user paid release.

## Controlled pre-merge smoke test

1. Private staging on this draft, test credentials held server-side only. Keep
   sweeps off and daily budget low. Record meter, open one football slate and one
   Game Lab, then repeat immediately. Compare outbound category deltas and provider
   headers. Do not run bulk ratings builds during the smoke test.
2. Verify reported provider cap/remaining against the account dashboard. Exercise
   zero quota using fixtures, never by intentionally exhausting the paid account.
3. Open NBA slate/context with entitled NBA credentials; repeat without new history
   calls. Check real game IDs/stage and compare completed scores with official data.
4. Restart staging: the meter must clearly show its observation is reset. Do not
   claim persistence. NBA must still function when football's fixture quota is zero.
5. App Store integration requires identifiers, customer auth/database, server
   reconciliation, an Xcode app target and sandbox/TestFlight validation described
   in subscriptions/README.md. Current code does not enable customer charges.

## Optional timing experiment

Two independent, default-off controls: Prime-Time Boost and Sunday Upset. NFL only.
Sunday/Monday kickoffs at 19:00 or later Eastern qualify for prime time. Sunday
12:00–15:59 Eastern qualifies for early games; London morning, late afternoon,
Thursday and college games are excluded. DST handled by America/New_York.

Prime-time assumptions: QB +20 passing yards, WR/receiver +12.5 receiving yards,
RB +17.5 rushing yards. Sunday option subtracts half these amounts from qualifying
star projections and compresses an agreeing market-favorite score margin by 15%,
capped at 2 points, preserving total. Simulation then recalculates percentages;
there is no manually added percentage-point win bonus.

Auto candidate roles use the latest three complete workload records (28 pass
attempts / 14 carries / 7 targets average), not verified star or position labels.
Player Lab offers explicit QB, receiver, RB and none overrides. Workload/weather
scale yardage effects; missing/withheld and zero-workload projections stay protected.
No additional provider calls. Scenario assumptions and model version are captured
in forecast records; existing first-forecast policy remains unchanged. Adjusted team
scenarios do not reuse baseline calibration. No empirical validation claimed.

403 Node tests pass, including actual client toggle flow and football regressions.
