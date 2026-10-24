# Unit501 resumption — October 24, 2026

Verified production: project humble-amazement, service Unit501. Railway CLI account and project access work; ChatGPT connector recovery is not established.

- Football provider Pro: active, 7,500/day; production guard also 7,500. At check: 14 requests used.
- Prior PRs #130 and #131 are on main. Includes prop-history readability, removal of break-even prices, numeric game counts, manual prime-time enhancement, upset panel and original/adjusted scenario comparisons.
- This change adds NBA/NHL to the four-source War Room, conservative repeated-selection counts, explicit NBA season-access errors, and an opt-in first-half 20-point score watch.
- Live feed smoke check: NBA Covers 11, Boyd's 4, Pickswise 8, WagerTalk 0 readable. NHL Covers 12, WagerTalk 1, Boyd's 1, Pickswise 12. These counts are transient, not guaranteed coverage or consensus.
- Repeated selections require an identified date, same matchup text and exact selection/line. Different aliases can remain separate. Undated picks are excluded. This favors missed matches over invented consensus.
- NBA provider returns an active Free plan (100/day), restricted to seasons 2022–2024. The 2026 request is explicitly denied. No subscription was purchased and no keys were replaced.
- Score watch requires current-season API access and an open, visible NBA page. It checks once per minute; server cache may delay initial updates. It is not background mobile push and cannot guarantee detection of a short-lived deficit between polls. One alert per trailing team/game per page session. Notifications require browser permission.
- NBA projections, player props, rotation/injury models and calibration remain unimplemented and are explicitly unavailable in the UI. Current-season access is needed for live validation; do not describe the NBA betting model as complete.
- Prior security follow-up (provider-key rotation and billing audit) remains unverified. Never store credentials in this repo.
- Big 12 board stays in chat according to the current app's explicit scope; no duplicate manual-entry board added.

Validation: full Node suite, live public-feed smoke checks, secret-safe provider status probes. Browser visual check attempted but browser download failed in this runtime; no visual QA claim.
