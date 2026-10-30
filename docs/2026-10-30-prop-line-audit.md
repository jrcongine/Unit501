# Missing player prop lines — partial fix and diagnostic coverage

Reviewed main bd5aa306 before changing code. The previous ca42882 change exposed
projections without odds; it did not increase provider market coverage.

Trace: exact event identity (ordered teams, league and time) -> event odds ->
main-market pairing/freshness checks -> exact unique player-name matching in the
football client -> manual override preservation -> projection/availability/view
filters -> existing difference, Above/Below/Equal and history calculations.
Basketball checks player-history identity separately from displaying a book quote.

## Implemented

- One shared strict parser for NFL/CFB and NBA/CBB. Identical repeated outcomes
  and identical market snapshots now recover one line. Conflicting names, prices,
  lines or timestamps are withheld, as are ambiguous bookmaker records.
- Each successful prop response includes eventId and audit: raw outcomes received,
  player/market quote candidates received, accepted, rejected by reason, individual
  rejected entries, identical outcome duplicates removed, returned market keys
  and requested market keys absent from the response. Absent markets mean not
  returned for this request, not proof that FanDuel offers no such market.
- Football shows unique loaded-player matches, unmatched/invalid quotes, manual
  overrides retained, and actual automatic table rows after filters. NBA/CBB
  show parser totals and displayed rows; quote display does not imply a verified
  history/player-model match.
- No fuzzy/suffix/abbreviated player substitutions, alternate-line substitutions,
  additional paid requests, freshness relaxation, layout column changes or model
  calculation changes. Existing projections without odds and manual entry stay.

Counts use explicit units: one quote candidate = one player name within one
returned market snapshot; one outcome = an individual Over/Under selection.
quotesReceived = accepted + rejected. Identical repeated outcomes within a
candidate are counted separately in duplicatesRemoved, not as rejected candidates.

## Validation

805/805 Node tests pass after npm ci, including existing client difference and
Above/Below/Equal behavior, overrides, matching, expiry and shared line history.
New mixed fixture: 9 outcomes, 5 quote candidates, 1 accepted, 4 rejected:
1 stale timestamp, 1 unsupported market, 1 unpaired quote, 1 invalid price.
This is a fixture, NOT production coverage. Recovered duplicate quote reaches
shared history with its original source timestamp and line.

## Still unverified — do not mark the work order complete

Actual live received/matched/displayed/rejected counts remain UNKNOWN. No claim
that identical duplicates caused Baylor–UCF's three-line symptom is established.
Direct contemporaneous FanDuel market comparison was not obtained. Search results
are not a substitute for the direct sportsbook response. The exact provider gap,
if any, is still unproven. Refreshing the props screen now exposes
the parser and client counts needed to locate that gap.

Scope is all existing automatic player prop paths (NFL, CFB, NBA, CBB). MLB has
no equivalent automatic player-prop path in this repository; no MLB feature was
invented as part of this fix.
