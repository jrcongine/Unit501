# API usage review — October 20, 2026

Owner-reported baseline: 10 / 7,500 at 09:09 America/Chicago (14:09 UTC).
This is a dashboard reading supplied by the owner, not a live API observation.

## Verified production state
Railway humble-amazement / Unit501: SUCCESS deployment
c7bc5199-9368-463f-92b5-47942d880d77, source main, one replica, no volume,
no staged changes. Automatic roster-sweep opt-in variable is absent.
PR 124 remains draft and its changes are not deployed.
No paid sports API requests were made for this review or its tests.

## Fixes added to PR 124
- Deduct a conservative provider allowance on every outbound attempt. Missing
  headers, failures and stale higher balances cannot refund spent requests.
- HTTP 429 respects Retry-After with a minimum 60-second shared cooldown.
  Zero minute balance and HTTP 200 API error payloads also pause new requests
  for 60 seconds; API errors count as failed responses instead of successes.
- Keep account-reported balance separate from locally estimated allowance.
- Usage panel shows outgoing-request delta since its first check on this page,
  resetting that baseline on server restart or UTC date rollover. Refreshing
  the meter itself sends no sports API requests.

## Validation and limits
417 tests pass (412 at the PR head before this review), including missing-header,
failure, cooldown recovery, rollover, and usage-panel regression coverage.
Syntax and diff whitespace checks pass.
No football prediction formulas changed.

The prior 7,500-call exhaustion is not fully attributed by available logs.
Counters, cooldowns and caches remain process-local and reset on restart.
No durable shared account budget or minute-rate pacing is claimed.
Unknown provider balance before the first response cannot prevent all initial
concurrent requests. Other clients using the same key remain outside this guard.

## Next verification
Deploy only after review of the draft's other bundled changes. Record provider
meter and local usage; open one slate and Game Lab, repeat immediately, then
compare category deltas and account headers. Keep bulk sweeps off. Never spend
through the quota to test exhaustion: those checks use fixtures.
