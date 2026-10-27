# Shared line history

NFL, college football and NBA FanDuel game lines and player props now use one server-side archive. Loading a matchup's game lines or props registers that market group for background refresh. Other devices receive the same first/latest quote and movement history through the existing endpoints. Moneylines are included in the game-line request (three markets instead of two).

## Coverage

- This is **first observed**, not a reconstructed sportsbook opening line. No historical quotes are invented or backfilled.
- Only loaded matchups are watched, up to 24 game/prop groups, within the next seven days. Loading props registers its own group. Tracking stops at kickoff.
- A group becomes due 15 minutes after its last successful response. The worker handles at most one group per minute, oldest due first, and shares the existing five-minute provider caches. A full queue, provider failures or the credit limit can create gaps. It does not capture every intraminute change.
- The archive stores each distinct source update count and each line change, including a move away and back. Repeated cached timestamps do not count as another observation. Older/conflicting timestamps are withheld.
- The API exposes first/latest timestamps, net change, change count, observed minimum/maximum, and the last 20 change points. Up to 256 change points are retained per series; the first is preserved. Series expire seven days after kickoff; storage is capped at 4,000 series.
- FanDuel is kept separate from comparison books. Supported prop markets remain those already parsed by the football and NBA adapters. Other leagues do not yet have a comparable quote route.

## Runtime

Configure one replica with a persistent Railway volume mounted at `/unit501-data`:

```
UNIT501_LINE_HISTORY_FILE=/unit501-data/line-history.json
UNIT501_LINE_HISTORY_BACKGROUND=1
UNIT501_LINE_HISTORY_DAILY_CREDITS=240
```

The file, watchlist and daily reservations are saved together with an atomic rename. The local disk fallback is explicitly labeled server memory and does not run the background worker. A corrupt archive is preserved; the app falls back to memory with background tracking disabled. Do not run multiple writers against the same file. The service's volume must persist across releases; an ephemeral image directory is not sufficient.

## Odds allowance

Background refresh reserves 3 credits for game lines, 8 for football props or 4 for NBA props before calling the provider. The default background cap is 240 reserved credits per UTC day; foreground requests are separate. Cache hits still consume this conservative internal reservation. Remaining allowance comes from `x-requests-remaining` on normal provider responses; no extra quota-probe request is sent. The worker preserves at least 50 known credits for interactive use and pauses on missing/day-old allowance, auth/rate errors, storage failures or its daily cap. Same-period higher/stale headers cannot replenish known allowance. The calendar-month boundary clears old allowance and requires a fresh provider header before background work resumes. Other applications using the same key can reduce the true remaining allowance between observations.

The odds-provider quota is separate from the 7,500 football API-Sports limit. This change does not increase the API-Sports budget or issue extra API-Sports schedule/stat requests.

Provider header/cost reference: https://the-odds-api.com/liveapi/guides/v4/

## Operation and verification

`GET /api/line-history/status` (existing private authentication required) reports persistence, watch count, latest applicable status, daily reservations and known remaining allowance. Individual quote responses include their own tracking state. Startup logs report storage status without keys, passwords or provider payloads.

Tests cover restart recovery, shared quote histories, line reversals, timestamp rejection, separate markets/teams/leagues, moneylines, budget reservation, overlapping ticks, queue limits, missing allowance, disk failure and corrupt-file preservation. Real provider movement cannot be proven until two different fresh quotes arrive after activation. A successful deployment alone does not establish full-slate coverage or visual layout correctness.
