# Football injury recovery follow-up

The user's Illinois–Maryland screenshots show fresh report-fetch timestamps,
multiple unresolved impacts, and zero automatic injury adjustments. Fetch
freshness does not establish report completeness or verified injury impact.

Two code defects were reproduced and repaired across NFL and CFB:

- A successful provider response with no box-score rows (or only the other
  team) aborted workload enrichment before independent recovery. Missing team
  records now seed unknown values and allow verified fallback reports to fill
  them. Duplicate team records still fail closed.
- Independently verified participation was discarded when the report contained
  no supported offensive markets. Such appearances now update participation
  without supplying any missing statistic. Contradictory DNP evidence still
  produces a conflict.

Validation: all 884 tests passed. New regressions cover both leagues, empty and
other-team-only responses, recovered workload, real public defensive box-score
participation with offensive categories removed, unknown statistics, and DNP
conflicts. The startup asset verifier now includes player-stats.js.

Limits: these tests establish recovery behavior, not the current availability,
role, replacement quality, or scoring effect of any named Illinois or Maryland
player. No provider secrets were accessed and no unsupported point penalties
were added. Live matchup recovery remains unverified behind application auth.
