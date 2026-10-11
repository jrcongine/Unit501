# Game switching audit — October 11, 2026

Executed the actual browser client scripts in the existing DOM/VM harness, including app, projections, availability and player-rating scenario UI. Three regression tests exercise state reset and deliberately deferred requests; no production behavior change was required in the exercised cases.

- Start with loaded projections and a confirmed replacement scenario, then delay injury, player-rating, team-ranking, game-odds and FanDuel-prop responses. Switch to another game and finish its availability/rankings/odds requests before releasing the old responses. The old responses do not overwrite new state or repopulate the cleared projections and ratings panel. Replacement inputs clear; manual injury points and team rating adjustments reset.
- Delay a player box-score request during projection loading. Switch games, then release it. The old request does not refill player choices, results or loading status, and the new matchup load button remains usable.
- Save a manual carries line and set a 50% workload scenario. Switch to another game with the same players. The new game uses its automatic line and a 100% workload setting. Returning to the exact original game restores its saved manual line. This deliberately isolates game scope even when team and player IDs are identical.

Validation: all 198 tests pass. The harness checks request ordering, state and text, not browser layout, network timing in production or every possible combination of user actions. Existing checks still cover scenario freshness, replacement availability and changed evidence. No assertion of complete injury coverage or calibrated forecast accuracy follows from this audit.
