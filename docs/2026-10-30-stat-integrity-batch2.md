# October 30: data accuracy, batch 2

## Reviewed baseline

Main and both Railway production services were at 553be4c. Installed the locked dependencies and reproduced 653 passing tests. That commit already supplies the narrowly scoped seven-game Jonnu Smith receiving correction, incomplete prop-history withholding, and Above/Below percentage sorting. No duplicate implementation of those features was needed.

## Changes

- NBA historical player replay now uses the same participation reconciliation as live NBA/college histories. Explicit DNPs remain separate from played games; a missing earlier player row prevents a reduced-denominator projection. Actual zero-stat appearances remain in the sample.
- Shared basketball coverage rejects duplicate appearances, played/DNP conflicts, duplicate expected games, and rows outside the historical window. NBA and college box parsers reject DNP designations that conflict with recorded minutes or positive statistics.
- NFL and college replacement workload profiles now require complete workload/yardage histories. Both manual scenario evaluation and automatic replacement allocation reject previously cached partial profiles; the former 50% coverage gate no longer applies.
- QB replacement estimates are withheld when either player has missing attempts or yardage in any compared team game. Missing appearances cannot silently reduce the sample.

## Validation

`npm ci`; `npm test`: 661 passing, zero failures, zero skipped. Eight additional tests cover missing earlier NBA rows, explicit DNP vs true zero, replacement profiles in both football leagues, cached partial profiles, missing QB stats, basketball contradictory participation/coverage, and a later unverified Jonnu game. Existing client integration tests verify percentage sorting and withholding. Two existing assertions were updated for intentionally stricter behavior: incomplete replacement profiles are absent; a college DNP fixture no longer incorrectly contains 30 minutes of playing time.

## Official source check and remaining limits

On October 30, https://www.packers.com/team/players-roster/jonnu-smith/logs/ still reports six receptions and 94 yards. It now includes October 29 vs Carolina with blank stat cells. Blank cells cannot determine whether Smith played or was DNP. The season-summary participation page could not be fetched during this session. The existing reviewed correction remains limited to the seven already-identified games; a regression verifies the eighth game remains unknown and prevents a full-history projection.

General automatic official NFL/college participation ingestion is NOT implemented. Existing provider box scores do not establish participation for omitted players; present-day rosters and injury reports cannot prove historical DNPs. This remains the blocker to claiming complete automatic zero-game reconciliation across all players. Missing records continue to withhold affected projections rather than become zero. Basketball reconciliation uses ESPN completed game boxes; no new league-official participation feed was added.

No new betting accuracy, calibrated confidence or regraded saved forecasts are claimed. No production secrets were read. Authenticated live feed/Smith UI checks remain dependent on owner access. Deployment outcomes are reported separately after committing this file.
