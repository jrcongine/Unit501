# Injury identity and starter-role recovery — October 31

Two linked defects were reproduced with regression tests before repair:

1. Report-to-roster matching rejected uniquely identified players with omitted suffixes when one source used a broad defensive label (DB, DL, LB or S) and the other a compatible specific position. Shared name matching now uses an explicit position-family table. Name collisions, conflicting suffixes and incompatible specific positions remain rejected.
2. College depth collection required exact position labels, and automatic football scoring accepted broad chart labels with specific roster labels but not the reverse. College collection and NFL/CFB scoring now share the same symmetric compatibility rules. Published starters can qualify without the arbitrary latest-tackle screen when the other existing evidence gates pass.

These are position compatibility rules, not new player identities or values. CB is not interchangeable with S, FS with SS, DE with DT, or WR with TE. Existing directional and edge aliases are retained. All official report, matchup, freshness, roster ownership and baseline participation requirements remain. Missing participation still withholds scoring; no injury penalties were invented or increased. NBA/CBB use separate basketball positions and are unchanged.

Validation: four new regression cases failed before the fix. The final full suite passes 896 tests. Tests cover both football leagues, unique-name/suffix matching, college depth collection, strict participation requirements, conditional-status withdrawal, incompatible positions, actual score and simulation propagation, and browser script load order. Production startup verifies the new helper and automatic injury script against deployed hashes. Deployment results are reported after release.

Remaining: current live matchup/provider completeness, unknown historical participation, replacement-quality calibration and broader injury-source coverage are not established by this batch. Existing hand-set positional sensitivities remain experimental.
