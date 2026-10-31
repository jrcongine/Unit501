# Game-market quality control — October 30, 2026

Reviewed GitHub main `fb46dcd16ed085523093ac87c76bbb39b0cd5d8f` and both successful Railway deployments before starting. Baseline: 833 passing tests. Earlier injury, prop, history and upset fixes were preserved.

## Changes

- NFL, college football, NBA and college basketball now share game-market validation. Each moneyline, spread and total has a bounded diagnostic for missing or duplicate bookmaker/market records, wrong paired selections, invalid/conflicting lines, absent/invalid prices, and missing/future/stale source timestamps.
- Valid markets remain usable when another market fails. Football retains its existing ability to use a paired line without prices, but labels that market partial. Basketball continues requiring paired prices. Invalid football spreads no longer retain detached prices or timestamps.
- Data Health marks incomplete game markets partial and gives short per-market reasons. Only whitelisted diagnostic codes are persisted; provider payloads and secrets are not stored. Existing saved status files remain readable. A successful refresh clears old diagnostics.
- Malformed game-market containers and null outcome rows cannot crash the shared parser or create fabricated lines. Existing strict event/team/kickoff matching remains in each adapter.

## Verification

- `npm test`: 841 passed; zero failures, skips or cancellations. Includes actual NBA/CBB request-adapter-to-health checks, NFL/CFB parser checks, malformed/duplicate inputs, freshness boundaries, zero spreads, recovery and persistence.
- `git diff --check` passed.
- Browser visual verification could not run: this environment has no Chromium executable, and the browser download failed. No desktop/mobile visual success is claimed. The display change adds safe text paragraphs to existing feed cards.

## Scope and remaining work

This validates returned provider payloads, not complete live FanDuel website coverage. Protected production API/screen verification still requires an authenticated session unavailable in this environment. No authentication settings or provider credentials were changed.

Prediction weights and probability calibration were not changed. Prior documented NBA home/rest validation did not support deployment; historical odds/injury/travel inputs and a genuinely untouched validation sample remain absent. Basketball team injury/replacement modeling, broader injury coverage and full live-provider acceptance remain unfinished. Passing these integrity checks is not proof of improved betting accuracy.
