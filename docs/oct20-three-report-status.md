# October 20 three-report implementation status

Draft branch based on the latest published injury-coverage branch, which itself depends on draft PR #124. Not merged or deployed.

1. Missing zero-production games: improved parsing of category-qualified yardage and explicit coverage in table/export/card. Regression verifies actual zeros survive ingestion and count in comparisons. Missing upstream player rows remain unknown; no supplemental source has been verified. Partially addressed, not closed.
2. Role/workload blending: implemented observed two-game workload shift and absolute opportunities scenarios, with explicit assumptions, unchanged historical outcomes, v3 archive version and no double counting of lineup opportunities. Automatic authoritative starter discovery and real-data calibration remain outstanding.
3. College injuries: preserved published source-coverage work (commit 92ec929) mapping all 138 FBS teams and adding Big 12/MAC/American adapters, pending-report handling and official links/manual fallback. Rechecked the official CUSA page and its linked Faktor embed; web retrieval again returned an empty embed document. CUSA automatic injury import and live point adjustments remain blocked; do not mark complete.

No paid sports API calls made. No new requests added by the player-model changes. API safeguards preserved. Full regression result recorded in PR description.
