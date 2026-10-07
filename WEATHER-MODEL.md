# Weather in football predictions

The experimental wind setting is on by default and can be switched off beside the simulation button. It reduces each team's projected score by 1% per mph of sustained wind above 15 mph, capped at 15%. This is an explicit heuristic, not a fitted or backtested improvement. It runs after schedule strength, manual point adjustments and home field, and its resulting scores feed the Monte Carlo simulation. Results report the scores before and after wind. Player props are unchanged.

Only the existing known open-air stadium locations qualify. Fixed domes bypass outdoor weather. Unknown venues and retractable roofs without a verified open-air location receive no weather adjustment. College stadium coordinates have not been added. Rain probability, gusts and temperature are displayed but do not change scores.

Forecasts must match the selected kickoff, be fetched within 15 minutes, and have a forecast hour within 30 minutes of kickoff. Past games, unavailable wind and stale forecasts retain the existing scores with an explanation. Reselect the matchup to refresh. Loading a forecast clears old simulation results; switching games prevents an earlier forecast from being applied to a new game.
