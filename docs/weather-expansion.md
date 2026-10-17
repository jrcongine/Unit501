# Matchup weather and props

Weather lookup now attempts both NFL and NCAA matchups using exact opponent, season and kickoff matching against ESPN. Neutral venues come from the event, never an assumed home city. Existing reviewed stadium coordinates/roof types take priority. Otherwise an exact city/state match supplies a clearly labelled city-area forecast; ambiguous locations remain unavailable. Retractable roof classifications in the reviewed catalog remain conditional.

Open-Meteo now supplies precipitation amount in mm/hour as well as probability. The shared experimental model uses kickoff sustained wind above 15 mph, precipitation above 0.5 mm/hour, and temperatures below 25 F or above 95 F. Passing/receiving yards, attempts/completions/receptions, carries, rushing yards and team scores have distinct bounded effects. Carries may increase slightly; rushing yards never automatically increase. Rain probability alone and gusts do not change estimates. TD markets are unchanged. Indoor, mismatched, expired or missing forecasts preserve the baseline.

These coefficients are explicit assumptions, not backtested estimates. Forecast inputs and applied factors are archived with props for future evaluation. The UI shows each prop's adjustment and before/after values. The weather toggle controls both team and prop adjustments.

Validation: 51 focused weather/team/injury tests pass. Expanded client suite: 85/90 pass; the same five home-field expectation failures reproduce at unchanged commit 37022ab. Live Texas–Florida lookup resolves DKR-Texas Memorial Stadium, Austin, outdoor, non-neutral. Availability display now names report designations instead of repeated generic participation warnings; injury feed completeness is not changed by this display fix.
