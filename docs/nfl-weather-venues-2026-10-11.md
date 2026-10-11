# NFL weather venue coverage — October 11, 2026

The client now resolves 30 domestic stadiums used by all 32 NFL clubs, plus Wembley and Tottenham Hotspur Stadium. Shared Rams/Chargers and Giants/Jets venues count once. Exact normalized venue names and explicit aliases determine location; the home team never substitutes for a missing or international location.

Coordinates are approximate stadium-area points, rounded to two decimals (roughly one kilometer), suitable for regional forecast context rather than field-level observations. Resolution is restricted to the reviewed 2026 season: same-name rebuilds and roof changes require another review. The catalog includes current Reliant Stadium and provider NRG Stadium aliases, the new Highmark stadium area, and the current outdoor Nissan and EverBank venues. It does not assume future Titans/Jaguars roofs.

## Exposure handling

- Open playing fields request forecasts and retain the existing experimental wind adjustment.
- Four fixed enclosed stadiums skip outdoor forecasts and adjustments.
- Five retractable-roof stadiums request outdoor forecasts for context. Game-day roof status remains unknown; the model does not apply outdoor wind.
- SoFi is classified separately as a covered field with open sides. Stadium-area wind is context only because field exposure is unverified.
- Other venues and seasons remain unavailable. College stadium coverage and international venues beyond the two London stadiums are not complete.

The existing visible-tab refresh applies to all supported forecast locations. This change does not add automatic game-day roof announcements or calibrate the wind assumption.

## Primary references checked

- NFL venue directory: https://support.nfl.com/hc/en-us/articles/35869724672660-Accessibility-Contacts
- Houston current stadium name: https://www.houstontexans.com/stadium/
- Buffalo 2026 open-air stadium: https://www.buffalobills.com/news/how-to-watch-the-bills-ribbon-cutting-ceremony-at-highmark-stadium
- Titans new stadium completion in 2027: https://amp.nfl.com/news/super-bowl-lxiv-to-be-held-in-nashville-s-new-nissan-stadium-in-2030
- Jacksonville 2026 construction: https://www.jaguars.com/news/jaguars-provide-2026-stadium-and-ticketing-updates
- Washington venue: https://www.commanders.com/stadium/stadium-guide
- Arizona retractable roof: https://www.statefarmstadium.com/about
- Indianapolis retractable roof: https://www.lucasoilstadium.com/tours-stadium-info/background-history/
- Atlanta retractable roof: https://www.mercedesbenzstadium.com/news/falcons-vs-packers-to-be-first-ever-event-with-roof-open
- Houston retractable roof: https://www.nrgpark.com/wp-content/uploads/nrg-park-brochure.pdf
- SoFi roof/open sides: https://static.clubs.nfl.com/image/upload/v1600817538/chargers/ga3hhidv49lwbnv6ewxf.pdf
- Wembley pitch uncovered: https://help.wembleystadium.com/support/solutions/articles/7000028144-does-the-roof-close-will-i-get-wet-if-it-rains-
- Tottenham NFL venue: https://www.tottenhamhotspurstadium.com/events/nfl-london-games

## Validation

Catalog tests check every club's dominant historical home venue, alias uniqueness, coordinate ranges, exact-name lookup, season limits, and distinct roof classifications. The actual client test checks retractable and covered forecasts remain model-ineligible, fixed domes make no weather request, and a London outdoor venue allows the existing wind adjustment. Full suite: 213 tests.
