# Final game-day inactive lists — October 11, 2026

Added a separate final-inactive report to availability, distinct from weekly injury statuses. The reviewed NFL source for Week 5 Sunday is:
https://www.nfl.com/news/nfl-week-5-inactives-players-ruled-out-sunday-2026-season

The live page sample contained 18 team lists and 114 entries. This is source coverage, not 114 matched provider identities. Later games had no list yet. The source contains "Caleb William"; that misspelling is not silently mapped to Caleb Williams. Existing reviewed starting-QB and injury gates continue independently.

The parser verifies the unique exact NewsArticle URL, publication date matching the game date, non-future publication/modification timestamps, the season/week statement, unique team headings, and recognized position/name list structure. Emergency third QB/quarterback entries are distinguished. Published empty or absent lists remain unverified.

The existing exact-matchup verifier starts final-inactive retrieval independently of the weekly source. Team lists require a fresh provider roster and unique name/position identity. Unmatched source entries remain visible as a count rather than becoming guessed player IDs. Reports carry league, season, game ID, kickoff, source URL, publication/modification time and actual retrieval time.

Final inactive entries block normal props and line comparisons, including emergency third quarterbacks with restricted eligibility. Missing names do not establish active status, starting role or workload. Exact-game and 15-minute freshness checks apply; past games do not use current availability. Source failures withdraw confirmation while preserving the weekly injury path. Pages refresh through the existing availability cycle and have a 15-minute cache.

Source discovery is not fully automated: the URL catalog currently covers only the reviewed 2026 Week 5 Sunday page. Future weeks and other game days require another verified source entry. Later-game lists can appear on this same page automatically without changing code.

Validation: parser rejection tests, game/season/freshness gates, unmatched identities, emergency QB handling, cache reuse/failure withdrawal, no active inference, and independence from weekly-source failures. The captured live HTML also parsed successfully. Full suite: 216 tests.
