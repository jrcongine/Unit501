# Basketball history identity recovery — October 31

Two reproduced gaps fixed across NBA and college basketball:

- History collection compared raw display names for an otherwise identical provider player ID. Accent, punctuation, case or an omitted generational suffix could discard valid game history. NBA could withhold the whole team's history; CBB could drop the affected game. Both now use the existing conservative basketball name matcher plus exact same-source player IDs. Explicit suffix evidence is retained so an omitted-suffix row cannot bridge Jr. and III identities. Actual identity conflicts still fail closed.
- Official NBA/NCAA reconciliation required an exact normalized full name including suffix. It now allows a unique omitted-suffix match, checking ambiguity on both sides. Conflicting explicit suffixes, duplicate/base-name collisions, played/DNP conflicts and statistical disagreement remain blocked. Only already validated official game reports can fill a record. Missing names never become DNP automatically.

NBA player replay uses the same identity rules for prior records and target eligibility, retaining chronological separation and all existing missing-history gates. Recovered records flow through existing coverage, Above/Below and injury-history consumers; this does not add numerical injury weights or assert improved betting accuracy.

Validation: both new NBA history and official reconciliation regressions failed before repair. Final full suite: 902 passed. Includes actual NBA/CBB history adapter tests, played versus DNP counts, omitted suffix in either order, explicit suffix-conflict retention, ambiguity, official DNP restoration and NBA replay target protection. Existing zero-stat, missing-history and client propagation tests also pass. No UI or authentication settings changed.

Limits: this repairs recoverable identity formatting. It cannot recover absent upstream game records, establish complete current FanDuel coverage, or calibrate replacement-player values. Authenticated live matchup histories have not been independently inspected in this batch. Deployment status and health are verified after release.
