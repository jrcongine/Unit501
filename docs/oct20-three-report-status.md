# October 20 three-report implementation status

Draft branch based on the latest published injury-coverage branch, which itself depends on draft PR #124. Not merged or deployed.

1. Missing zero-production games: improved parsing of category-qualified yardage and explicit coverage in table/export/card. Added a verified South Alabama receiving-box-score recovery path on October 21 (details below). Other source gaps remain unknown. Partially addressed, not closed.
2. Role/workload blending: implemented observed two-game workload shift and absolute opportunities scenarios, with explicit assumptions, unchanged historical outcomes, v3 archive version and no double counting of lineup opportunities. Automatic authoritative starter discovery and real-data calibration remain outstanding.
3. College injuries: preserved published source-coverage work (commit 92ec929) mapping all 138 FBS teams and adding Big 12/MAC/American adapters, pending-report handling and official links/manual fallback. Rechecked the official CUSA page and its linked Faktor embed; web retrieval again returned an empty embed document. CUSA automatic injury import and live point adjustments remain blocked; do not mark complete.

No paid sports API calls made. No new requests added by the player-model changes. API safeguards preserved. Full regression result recorded in PR description.

## October 21 follow-up

Rechecked draft PR #125 and reproduced its 434 passing tests. Found and corrected a parser inconsistency: opponent team-yardage aggregation accepted only `Yards`, while individual histories also accepted `Passing Yards`, `Rushing Yards`, and `Receiving Yards`. Both now use the same metric definitions. Regression coverage checks qualified and generic labels, explicit zeros, negative yardage, missing values and unrelated categories. This prevents qualified labels from being dropped in opponent matchup inputs; it does not recover absent upstream player rows or complete injury imports. No new requests or deployment.

Further review found the workload warning skipped missing records even though the projection's shift detector correctly requires consecutive games. The warning now explicitly flags a missing previous team-game workload instead of claiming a consecutive two-game trend. Explicit zeros still count. Tests cover null, absent, invalid, negative and zero usage.

Rechecked CUSA's official availability page and linked 2026 Faktor embed: web extraction returned no content and direct retrieval returned HTTP 403. No automatic importer can be validated from that response. South Alabama's official 2026 cumulative statistics page is accessible and includes participation totals, but season totals alone cannot establish individual missing-game yardage; supplemental per-game ingestion remains unfinished. Sources: https://conferenceusa.com/sports/2025/8/23/FB_0823254134.aspx and https://usajaguars.com/sports/football/stats/2026 .

## October 21: first verified game recovery

The South Alabama official per-game source is now connected in the draft. Live retrieval through the new importer returned Anthony Eager's explicit 0 receptions / 0 receiving yards / 0 receiving TDs at Arkansas State on October 8, 2026: https://usajaguars.com/boxscore.aspx?id=11381&path=football . The captured receiving-table fixture is an excerpt of that source.

The client requests recovery only for missing receiving-game yardage, after loading and completing the existing game calendar. The source matches season, game date and opponent, validates the box-score heading and date, and requires receiving rows to sum to the published totals. Full-name matching must be unique within the provider team and source rows. Conflicting known stats block recovery for that player; absent rows and targets remain unknown. Only missing receiving fields are filled. Cards disclose recovery and link the source. Public requests share a bounded 15-minute cache; no paid API request is added. Source failure leaves existing stats usable and missing values unknown.

Scope: South Alabama, 2026, receiving records for already-known provider players against identified FBS opponents. This does not recover all teams, infer a zero from participation alone, discover players wholly absent from the provider, or implement current starter/injury discovery. CUSA imports remain blocked. Draft only, not deployed.

## October 21: first-game workload review

The workload warning now identifies one sharply changed latest game against two stable, recorded preceding team games. It explains that a first start, reduced usage, or game circumstances need role verification and points to the existing expected-workload scenario. It does not claim a confirmed starter or automatically change the projection from a single game. Sustained two-game adjustment behavior is preserved. Missing, invalid, and undated records cannot establish this new signal. Two new regression tests cover first-game increases/decreases, preserved historical outcomes, explicit attempts scenarios, receiving targets, stable usage, and gaps. All 27 player-form tests pass. Automatic authoritative starter discovery remains unfinished; this is a review safeguard only. No API requests added. Draft only.
