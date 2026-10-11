# NFL morning availability audit — October 11, 2026

Checked live availability shortly after 9:00 a.m. Central. Eagles–Jaguars was already in progress and excluded from current pregame eligibility checks. The other 12 games were not started. Retried four matchup requests with incomplete first-pass source/ownership checks; successful retries are reflected below. A failed check is not evidence of health.

- 24 of 24 teams had available official weekly injury reports.
- All 12 matchups had a complete 32-team roster ownership check.
- 62 matched official Out/Inactive rows were blocked by the actual player availability model; none escaped the gate.
- 65 official injury rows remained unmatched to the corresponding provider rosters.
- 23 of 24 team depth charts were available; Houston remained unavailable.
- Existing exact-game starter confirmations for Tyson Bagent, Jayden Daniels and Jacoby Brissett reverified.

Added a fourth reviewed starter: Tyler Huntley for Baltimore at Atlanta, game 21590. The official Ravens October 9 injury article explicitly names Huntley as Sunday's starter with Jackson ruled out. Confirmed the current roster identity and stored publication, modification and body hash in `starter-confirmations.json`. Article URL: https://www.baltimoreravens.com/news/lamar-jackson-trey-hendrickson-injury-report-marlon-humphrey-zay-flowers-ronnie-stanley-ravens-falcons

The existing source verifier withdraws a changed/unavailable article confirmation. The existing exact matchup, kickoff, roster, publication-age and availability guards remain required. Starter confirmation establishes role, not future attempts, efficiency or calibrated team-score impact. No missing backup workload was invented.

This snapshot is not a final game-day inactive list for the 12 upcoming games. Weekly Out reports, questionable designations, announced starters and final inactives remain distinct. Later updates must be rechecked before kickoff. No new automatic inactive-list parser was added in this change.

Validation: all 198 tests pass, with the starter fixture extended to Huntley, including exact-game/kickoff expiry and official Out overriding starter confirmation. Verified the saved review against the actual fetched Ravens article. Counts describe this morning's live responses and exclude unmatched rows from the 62 blocked identities.
