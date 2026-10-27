# NBA readiness — October 27, 2026

This release improves the existing NBA dashboard; it does not certify betting accuracy or remove beta.

- Player history now uses up to ten completed team games. Player appearances are sorted chronologically and future/duplicate/mismatched results are rejected.
- When minutes are available, per-minute production and projected minutes use exponentially declining appearance weights (0.85 per older appearance). Default minutes are capped at 48. A user can enter 1–48 minutes per player, shared across that player's displayed markets and cleared on matchup changes. These weights are a heuristic, not fitted or calibrated.
- Historical above/below/equal counts remain actual results at the current line. Minutes adjustments never change these counts. Observed recent minutes shifts require at least five appearances and a five-minute difference between the latest two and older appearances; they do not claim a confirmed starting role.
- A missing opposing team's player history no longer suppresses verified estimates for the other team. A malformed minutes row quarantines that player instead of hiding the team. OUT players remain suppressed.
- Rest cards show home/road sequences and reported arenas. No travel distance or transportation method is inferred.
- The first-half watch runs in an open background tab, discards stale responses and outdated requests, retries temporary failures, and uses a public scoreboard endpoint. No paid NBA or odds API is invoked by this endpoint. Before 6 a.m. Central it also checks the previous day's slate. Browser throttling and polling intervals can delay or miss short-lived deficits.

Validation: 556 passing Node tests; focused client tests cover minute controls, unchanged historical counts, matchup resets, stale requests, watch restart/off, and temporary upstream failure. Live ESPN checks confirmed the October 27 slate, Detroit–New York rest/arena context, and player-history parsing. A real Knicks box score with Pacome Dadiet minutes reported as `--` prompted the per-player quarantine regression test. These smoke checks do not establish predictive accuracy. Browser visual verification was unavailable because the Chromium download failed.

Remaining release gates:

1. Historical out-of-sample team and player accuracy evaluation. Team scoring remains the existing uncalibrated offense/defense average; simulation frequencies are not calibrated probabilities.
2. Automatic injury/rotation replacement estimates require verified lineup and minutes information; manual minute scenarios do not establish an expected rotation.
3. Closed-app push notifications require server-side subscription delivery and service-worker/platform validation. This release requires an open tab.
4. College basketball is not implemented by this NBA release.

No new paid provider subscription or infrastructure configuration is required.
