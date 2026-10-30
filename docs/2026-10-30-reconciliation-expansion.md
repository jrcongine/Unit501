# Batch 2: reconciliation expansion

Reviewed GitHub main db6af05 and both successful Railway deployments before changing code. Earlier fixes were retained.

## Changes

- NFL: discover a game's official PDF from either team's official schedule/game center, using a fixed list of 32 team domains. Only same-origin canonical redirects and NFL-hosted gamebook links are accepted. The downloaded gamebook independently verifies game identity, date, scores, participation and table totals. Locate final individual statistics within the first six PDF pages, including expanded player-name abbreviations.
- NFL and college football: use completed ESPN box scores as an explicitly identified secondary source when no supported official gamebook is available. Verify provider/public matchup, season, stage, kickoff and final scores. A recorded nonzero event or explicit participation flag establishes an appearance; complete, reconciled category totals support omitted zeros. An absent player stays unknown. No roster-based DNP inference. Unreported targets remain unknown. Evening games check Central and UTC scoreboard dates.
- Client: apply only uniquely matched players and verified fields. Conflicts remove statistics and withhold projections. Allow time for gamebook verification and show progress. Data Health now labels the combined feed Player participation.
- NBA/CBB: retain explicit DNP/zero/missing separation; reject DNP rows with any shot attempts. CBB history now rejects wrong-season/stage summaries, conflicting schedules and unverified completed games. The shared model supplies zero-inclusive medians; both UIs show medians and small-sample notices, and CBB shows Above/Below/push percentages with the played-game denominator.
- NFL/CFB production grades: incomplete metric histories no longer enter the grade or same-position peer pool. Existing full-coverage replacement-profile, quarterback and NBA replay protections remain in force.

## Validation

- `npm test`: **690 passed, zero failed**. `git diff --check` passed.
- Regression fixtures include real NFL gamebook data, Pitt–Miami October 24, NBA October 29 and the CBB April 6 championship box score.
- Live public-source requests verified Pitt–Miami and reconciled 39 Pittsburgh plus 38 Miami appearances.
- Live official schedule discovery found the Packers–Vikings September 13 gamebook (outside the original four-game registry). Its downloaded PDF extracted and parsed successfully after layout fixes: 54 Packers and 55 Vikings entries; Jonnu Smith 2 receptions, 50 yards, 3 targets.
- Added tests cover source identity, missing categories, mismatched totals, unknown participation, conflicts, partial fields, redirects, evening dates, CBB history gaps, zero-inclusive averages/medians/hits/misses/pushes and incomplete production grades. Existing replacement and NBA replay regressions also passed.

## Coverage and verification limits

This is not an exhaustive audit of every historical player/game. Official NFL discovery supports recognizable team-site links and gamebook layouts; other layouts remain unavailable. College football currently uses verified ESPN completed box scores, not an official NCAA all-participant feed. A player absent from every stat category remains unknown unless separate participation evidence is available. NBA/CBB retain their verified ESPN box-score source; direct NCAA and NBA endpoints rejected requests in this environment. Unsupported fields, ambiguous identities and incomplete histories stay withheld.

Private Basic authentication still prevents checking the deployed player screens and paid provider-to-public-source matching end to end. Public source tests use a supplied provider game identity, not production provider credentials. Railway deployment state and public health checks are separate from this outstanding verification. The secondary Railway service has no live provider credentials.

## Source evidence

- https://www.packers.com/schedule/
- https://www.packers.com/game-day/2026/reg-week1/packers-at-vikings/
- https://static.clubs.nfl.com/image/upload/packers/x7lnsyzwju871itpwm4v
- https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=401858274
- https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401909893
- https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=401856600
