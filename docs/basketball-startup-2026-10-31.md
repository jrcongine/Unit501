# Basketball dashboard startup

Basketball navigation opens College Basketball by default; the league selector still opens NBA explicitly and preserves the date. Both basketball pages automatically request the selected date's slate, their own public-picks War Room, and rankings/headlines. These are independent: an empty or failed slate cannot suppress news or picks. Initial slate events reuse the in-flight/recent league update instead of duplicating it. Refresh controls remain available. No matchup, injury, prop, or simulation requests are made before selecting a game.

The War Room stays collapsed initially, matching football's presentation, but its selected basketball feed is preloaded. It stays on the basketball page. Existing open-panel refresh rules are retained.

College basketball uses the current-season AP Top 25 via ESPN, explicitly labeled as a published poll with its original publication date and vote totals. This is not UNIT 501's calculated football/NBA power index. Invalid, incomplete, ambiguous, wrong-season, future or old poll data is withheld; current headlines can still display. NBA retains its existing power index. Poll data does not affect projections.

Validation: Node regressions cover date-before-load sequencing, default college navigation, panel presence, unique IDs and strict poll validation. Chromium checks passed at 390px and 1440px for both basketball leagues with empty and failed slates: exactly one automatic request per feed, correct league/date, working refresh, no matchup calls, no console exceptions and no horizontal overflow. Screenshots were inspected. These browser checks used mocked responses; the current live ESPN college poll also parsed as 25 teams.
