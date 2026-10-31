# Shared football and basketball layout

User requirement: football, NBA and college basketball should look alike;
applicable UI fixes should carry across all sports.

The three pages now load `public/sport-layout.css` last. It owns common
navigation, date/league controls, slate cards, selection accents, result tiles,
buttons, report details, player-section headings, table spacing and responsive
breakpoints. Make common visual changes there, not in one sport's override.
`sport-layout.js` shares date-picker behavior and basketball league navigation,
preserves the selected date, and enables section links only after selection.
Football retains its existing selection handler.

NBA and college basketball follow the numbered Game slate → Game Lab → Player
Projections sections. College props are now a separate top-level section like
football and NBA. All show Projected / Away cover / Over / Away win tiles.
Basketball uses the shared `resultTiles` helper, withdrawing stale/unavailable
values and preserving verified zero probabilities. Missing lines show dashes.
NBA still updates automatically and also offers a Run simulations button;
college runs on request. Simulation counts and sport-specific models are
unchanged. Raw ties and experimental model limitations remain visible.

Validation: 886 Node tests passed, including client selection, refresh,
staleness, props and injury tests. New regressions check shared page structure,
unique IDs, unknown-versus-zero tiles and clearing unavailable results.
Chromium checks with mocked provider responses passed at 390px and 1440px for
football, NBA and college basketball: slate load, selection, basketball
simulation, missing-line tiles, reset navigation, date retention between
basketball leagues, no JavaScript exceptions and no page-width overflow.
Screenshots were inspected on mobile and desktop. These were layout fixtures,
not live provider coverage verification.

Production startup verification includes all three HTML pages, the shared
stylesheet/navigation/helper, and both basketball clients. This validates
served assets against the deployed files without requesting paid data.
