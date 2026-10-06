# Home-field adjustment

Game location defaults to Automatic for every newly selected matchup. Automatic compares the scheduled venue name with normalized names from completed pre-kickoff games. At least two earlier home appearances for the designated home team at that venue and no earlier home appearances there for the away team infer a home venue. This inference is not a verified venue ownership or neutral-site flag: a repeated neutral venue could still qualify. The result note tells users to verify exceptions. Missing, shared or insufficient venue history applies no boost.

Home stadium explicitly selects the home assumption; Neutral site always disables it. Changing the selector invalidates prior simulation results. Player props are unchanged.

Experimental assumptions are a 2-point NFL or 3-point college home-margin boost. Half is subtracted from the away score and added to the home score after schedule strength and manual adjustments, preserving the projected total. If the away score is below half the boost, the transfer is reduced so scores remain nonnegative; the note reports the actual margin change. These constants are not fitted or calibrated team-specific advantages. Travel, altitude, surface, roof and weather effects are not modeled.

Validation: 40 Node tests pass. Tests cover inferred venues, neutral overrides, unknown/shared venues, historical cutoff/deduplication, total preservation, league assumptions and nonnegative scores. JavaScript syntax and whitespace checks pass. Browser rendering and live provider venue completeness still need verification.
