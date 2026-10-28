# NBA teammate absence minutes scenarios

Player props now offer an optional minutes scenario when a fresh official OUT report and verified history support at least two player appearances with the teammate playing and two with an explicit DNP. Missing rows never count as absences. Each comparison requires matched team names, matching game IDs and timestamps, valid minutes and unambiguous participation records.

“Try … minutes without …” applies the observed average minutes from the DNP group to the player's overall recency-weighted per-minute stat rate. It does not use the absent-group production rate or claim to predict a replacement rotation. The UI shows the baseline and change, retains actual historical above/below/equal counts, and provides Reset minutes. Selection is optional, shared across that player's displayed markets where supporting data exists, and cleared when changing matchups. A lost, changed, stale or unavailable supporting split clears the scenario; changing to a manual minutes value makes it an independent manual assumption.

DNP causes can differ, samples can be small, and multiple teammate absences are not combined. Automatic injury adjustments remain off. No additional data requests or paid API calls are introduced. These scenario checks are not historical accuracy validation.

Validation covers contradictory DNP rows, duplicate identities, wrong-team and mismatched-date evidence, manual selection/reset, loss of injury evidence, unchanged default projections and historical counts, and no extra feed calls.
