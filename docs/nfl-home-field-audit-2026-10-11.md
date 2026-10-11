# NFL home-field rankings and matchup context — October 11, 2026

Added optional team-specific NFL home-field estimates and a separate user-entered matchup-context edge. The current flat home bonus remains the default because the team-specific candidate did not improve the historical check.

## Historical estimates

Retrieved 2024 and 2025 team schedules across all 32 NFL teams through API-Sports. The checked-in compact source contains dates, identities, venues, final statuses and scores. There are 256 verified 2024 regular-season finals and 272 verified 2025 finals; 16 additional 2024 entries lack final status and are excluded. No missing score or final status is inferred.

Fit margin as home team strength minus away team strength plus the home team's advantage. Strength is separate by season, with an eight-game shrinkage prior. Team home effects shrink toward the existing two-point assumption with a 20-game prior and are bounded to zero through five points. Require at least six home and six away games for an available estimate. Dominant season home venue must appear at least three times; alternate, unknown and shared opponent home venues are excluded. This is a performance estimate, not a crowd-noise measurement or a causal estimate of stadium atmosphere.

The combined descriptive ranking uses 517 venue-eligible games; 11 verified finals have excluded venues. Example estimates: Kansas City rank 6 (+3.63 points), Miami rank 22 (+1.27), Seattle rank 23 (+1.18), Tennessee rank 29 (+0.50). The results do not justify hardcoding Seattle above Miami solely from crowd reputation.

## Held-out check

Train home-field estimates on 2024 only. Evaluate the existing scoring model on 2025, rebuilding team/opponent scoring inputs from games at least 24 hours before each kickoff. Compare flat and team-specific bonuses on the same 195 eligible games. Home-field training is frozen before the evaluation season; venue eligibility at prediction time uses only earlier games.

| Margin mean absolute error | Points |
| --- | ---: |
| Existing flat bonus | 10.7067 |
| Team-specific candidate | 10.8944 |

The candidate worsened margin error by 0.1877 points. It stays an explicitly optional experiment, switched off by default. This evaluation is not betting-profit validation. Run `node scripts/home-field-audit.js` to reproduce; `--write` also rebuilds the published profile.

## Model and interface

The selected team's estimate, historical rank, sample counts and failed-improvement result appear by the venue settings, with a collapsible 32-team table. The optional NFL estimate requires exact season, complete unique team identities and historical cutoff before the selected kickoff. Unavailable estimates retain the existing venue assumption. Neutral and unverified automatic venues receive no bonus.

A separate zero-to-three-point home matchup-context input lets the user express a rivalry, prime-time or motivation judgment. It defaults to zero, resets when selecting a game, is ignored at neutral/unverified venues and never automatically assigns emotional value. Changes invalidate the displayed simulation. Both adjustments transfer half the margin between scores, preserve the total and leave player props unchanged. Changed home-field/context scenarios use distinct model versions in forecast archives and do not reuse baseline probability or variance calibration.

Validation: 209 tests pass, including future-result exclusion, conflicting game identity, full team pool, league/season/cutoff scope, neutral/unverified venue overrides, bounds, total conservation, calibration withholding and actual client control/reset behavior. No basketball, phone or weather refresh changes are included.
