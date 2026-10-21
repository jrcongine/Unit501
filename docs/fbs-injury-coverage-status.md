# FBS injury coverage — October 20, 2026

## Implemented locally, not deployed

All 138 teams in the existing 2026 FBS identity catalog now map exactly once to their football conference or independent school source, using a retrieved 2026 ESPN standings snapshot. Membership is season-scoped: other seasons and unknown identities do not inherit 2026 assignments.

| Source | Automatic adapter | Official entry point |
|---|---|---|
| SEC | Existing HD Intelligence | https://www.secsports.com/fbreports |
| ACC | Existing HD Intelligence | https://theacc.com/sports/2025/8/28/availability-reporting-football.aspx |
| Big Ten | Existing HD Intelligence | https://bigten.org/sports/2026/9/10/FB_Availability_Reports.aspx |
| Big 12 | Added HD Intelligence, provider B12 | https://big12sports.com/sports/2025/8/14/FBreporting.aspx |
| MAC | Added HD Intelligence, provider MAC | https://getsomemaction.com/sports/2026/7/28/FB_0728265050.aspx.aspx |
| American | Added HD Intelligence, provider American | https://theamerican.org/sports/2026/8/6/football_player_availability.aspx |
| CUSA | Not connected | https://conferenceusa.com/sports/2025/8/23/FB_0823254134.aspx |
| Mountain West | Not connected | https://themw.com/sports/2026/5/26/FB_0526264123.aspx |
| Pac-12 | Not connected | https://pac-12.com/news/2026/9/11/2026-football-reports.aspx |
| Sun Belt | Not connected | https://sunbeltsports.org/news/2025/8/11/football-availability-report-new.aspx |
| Notre Dame | School fallback; no school importer | https://fightingirish.com/pressbox |
| UConn | School fallback; no school importer | https://uconnhuskies.com/sports/football |

Notre Dame and UConn are not assigned to an all-sport conference. A report from an opponent's supported conference can cover either independent when it explicitly matches both teams and the kickoff. Conference membership alone never establishes availability. One-team reports are not accepted as complete matchup reports.

## Source verification and limitations

The official Big 12, MAC and American pages link to the observed HD Intelligence provider IDs above. Direct public JSON requests succeeded for all three. Current responses contained pending reports only, not published player statuses. The existing shared player parser has synthetic regression tests for the new conferences; live populated-row verification remains outstanding. Do not claim verified live injury scoring from these pending payloads.

CUSA's embedded Faktor report returned an empty document. Mountain West, Pac-12, Sun Belt, MAC and American page fetches from the local runtime returned 404 in this investigation even when the web retrieval service could read some pages. The MAC and American public JSON endpoints were independently accessible. No unobserved endpoint or report schema is guessed for other sources. Notre Dame's public media page loads and points to a Box embed; a current structured availability report was not verified. UConn's official football page is a school-update fallback, not a verified report feed.

## Behavior

- Fetch only the supported conference source(s) relevant to the selected matchup, sharing the existing 15-minute cache. Do not fan out to every conference.
- Preserve the existing one paid game-validation request; no new paid-provider source calls are introduced here. Downstream role/history checks still use the existing bounded caches when reports qualify.
- Never accept a Report Pending placeholder as a published empty injury report, even after its planned publication time.
- Surface source-specific report coverage: verified, incomplete, unsupported, unavailable, or conflict. Verified describes the imported game report, not confirmation of every player's health or a calibrated point value.
- Preserve identity, exact-matchup, publication-time, role, QB replacement/history and double-counting guards. Missing, stale, ambiguous and conditional evidence does not fabricate points.
- Display official report/update links and manual-entry guidance for unsupported sources, including independents.

## Validation

Full suite after implementation: 427 passing, 0 failing. Tests cover all 138 source mappings, conference realignment, independent fallback/opponent-report coverage, new provider IDs and aliases, pending placeholders, source failures, ambiguous reports and existing football behavior.

## Remaining work

Implement verified source-specific adapters for CUSA, Mountain West, Pac-12, Sun Belt and independent school reports. Obtain real populated report samples for the new HD adapters. Verify live integration before deployment. Full automatic all-FBS injury coverage is not complete.
