# October 20 three-report implementation status

Draft branch based on the latest published injury-coverage branch, which itself depends on draft PR #124. Not merged or deployed.

1. Missing zero-production games: improved parsing of category-qualified yardage and explicit coverage in table/export/card. Regression verifies actual zeros survive ingestion and count in comparisons. Missing upstream player rows remain unknown; no supplemental source has been verified. Partially addressed, not closed.
2. Role/workload blending: implemented observed two-game workload shift and absolute opportunities scenarios, with explicit assumptions, unchanged historical outcomes, v3 archive version and no double counting of lineup opportunities. Automatic authoritative starter discovery and real-data calibration remain outstanding.
3. College injuries: preserved published source-coverage work (commit 92ec929) mapping all 138 FBS teams and adding Big 12/MAC/American adapters, pending-report handling and official links/manual fallback. Rechecked the official CUSA page and its linked Faktor embed; web retrieval again returned an empty embed document. CUSA automatic injury import and live point adjustments remain blocked; do not mark complete.

No paid sports API calls made. No new requests added by the player-model changes. API safeguards preserved. Full regression result recorded in PR description.

## October 21 follow-up

Rechecked draft PR #125 and reproduced its 434 passing tests. Found and corrected a parser inconsistency: opponent team-yardage aggregation accepted only `Yards`, while individual histories also accepted `Passing Yards`, `Rushing Yards`, and `Receiving Yards`. Both now use the same metric definitions. Regression coverage checks qualified and generic labels, explicit zeros, negative yardage, missing values and unrelated categories. This prevents qualified labels from being dropped in opponent matchup inputs; it does not recover absent upstream player rows or complete injury imports. No new requests or deployment.

Further review found the workload warning skipped missing records even though the projection's shift detector correctly requires consecutive games. The warning now explicitly flags a missing previous team-game workload instead of claiming a consecutive two-game trend. Explicit zeros still count. Tests cover null, absent, invalid, negative and zero usage.

Rechecked CUSA's official availability page and linked 2026 Faktor embed: web extraction returned no content and direct retrieval returned HTTP 403. No automatic importer can be validated from that response. South Alabama's official 2026 cumulative statistics page is accessible and includes participation totals, but season totals alone cannot establish individual missing-game yardage; supplemental per-game ingestion remains unfinished. Sources: https://conferenceusa.com/sports/2025/8/23/FB_0823254134.aspx and https://usajaguars.com/sports/football/stats/2026 .
