# Batch 2 follow-up: official participation

This extends commit 7166540d938e1d327b7de2257608a37e6c19f484. It does not complete all-sport source reconciliation.

## Delivered

- Parse official NFL gamebook starting lineups, substitutions, Did Not Play and Not Active sections. Validate matchup, date, final score, roster structure and offensive table totals before applying statistics.
- Reviewed source registry covers Packers games against the Jets (September 20), Bears (October 11), Cowboys (October 18) and Panthers (October 29). Parse all roster participants; apply only unique player matches with verified provider game identity. Unsupported games remain unavailable.
- Verified participation plus complete reconciled passing, rushing and receiving tables permits omitted statistics to become zero. DNP stays separate. Conflicting provider data is quarantined and cannot silently become a projection.
- Jonnu Smith played with zero receptions/yards in the three reviewed September/October games; October 29 is a verified DNP. Across his seven appearances, receiving yards total 94: over 3.5 yards has four hits and three misses. Over one reception has two hits, three misses and two pushes. The DNP is excluded.
- Client history uses the authenticated participation endpoint. Verified DNP is excluded from averages, medians, workload calculations, Above/Below denominators and replay targets. Unknown participation still blocks complete-history projections.
- Data Health distinguishes unavailable official participation from a successful verification response.

## Validation

`npm test`: 672 passed, zero failed. Includes extracted first-two-page fixtures from all four official gamebooks, identity/layout/total rejection, conflicting and ambiguous players, caching, DNP/unknown arithmetic, hit/miss/push counts, client integration and feed-health classification. The actual downloaded PDFs also passed extraction and parsing locally.

## Remaining work and verification limits

- Automatic official-source discovery across the remaining NFL schedule and college football is not implemented. The registry currently contains only these four NFL games.
- Earlier NBA/college basketball coverage protections and replacement/backtesting fixes remain in place; this change adds no new official basketball source reconciliation.
- Only supported passing, rushing and receiving fields are reconciled by this parser. Other markets are not independently verified by this source.
- Production requires private Basic authentication. Without that login, deployment health can be checked but the authenticated live player screen and live provider-to-gamebook reconciliation cannot be verified. The secondary Railway service also lacks live provider credentials.

## Official sources

- [Panthers gamebook](https://static.clubs.nfl.com/image/upload/packers/ia7jnbokrjesqdfxqreh)
- [Cowboys gamebook](https://static.clubs.nfl.com/image/upload/packers/fgwfiyxcsyutwuntwjcb)
- [Bears gamebook](https://static.clubs.nfl.com/image/upload/packers/pqpptpb5ckujllxac1md)
- [Jets gamebook](https://static.clubs.nfl.com/image/upload/packers/zu3fdftopjkj8hkcwckc)
- [October 29 inactive report](https://www.packers.com/news/packers-panthers-week-8-inactives-oct-29-2026)
