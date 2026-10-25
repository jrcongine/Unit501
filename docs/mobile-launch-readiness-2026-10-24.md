# UNIT501 mobile launch readiness

Reviewed October 24, 2026 (America/Chicago). Source: `jrcongine/Unit501`, main commit `dcbffcdab55812c9664075610302d2d0e8c00bcb`.

## Result

Continue from the existing application. The repository contains the football models, War Room, forecast tracking, NBA matchup history, and FanDuel quote integrations. There is no technical reason identified by this review to discard those features or rebuild the entire product.

The current application is an owner tool, not yet a customer subscription product. A mobile shell alone would not complete the launch.

## Verified

- Ran the current Node regression suite: 433 passed, zero failed, skipped, or cancelled.
- Production `/api/health` returned HTTP 200 with `ok: true`, `private: true`, and `liveData: true`. This confirms a responding service and a configured football key; it does not validate provider access or current quotes.
- `server.js` gates application requests through `private-access.js`. That module uses one owner Basic Authentication login. No customer account, session, recovery, or subscription implementation was found in the reviewed source.
- `public/index.html`, `public/nba.html`, and the stylesheets include viewport settings and responsive rules. Actual iPhone/Android visual and interaction testing remains outstanding.
- War Room decisions and forecast archives use browser localStorage. These records do not currently synchronize between devices or belong to server-side customer accounts. Existing export features should be preserved.
- NBA supports configured-provider and labeled public-source schedules/history, plus a separate FanDuel market quote integration. The current NBA UI explicitly states that UNIT501 score and player projections are not active.
- NBA score watching pauses when the page is hidden. It is not background mobile push.
- No native mobile project, app manifest, service worker, customer billing integration, or account database implementation was found in the repository inventory.

## Order of work

1. **Customer data foundation:** introduce customer identity and server-side persistence with per-user access rules. Preserve existing browser records and design a validated import path; do not erase local history during migration.
2. **Access and billing:** retain a separate owner/admin role; implement customer sessions, account recovery, subscription entitlements, verified payment events, and tested cancellation/access behavior. Decide the mobile distribution and billing approach before integrating checkout.
3. **Phone experience:** test the existing NFL and NBA workflows on small screens, including dense tables, forms, loading/errors, and navigation; fix the concrete failures found.
4. **Launch feature scope and data:** verify real current-season NFL/NBA feeds and FanDuel coverage with authorized production access. Treat NBA projections as unfinished; either complete and validate them or launch NBA explicitly as matchup research and market quotes.
5. **Mobile packaging:** choose and implement the iPhone/Android distribution approach after reviewing the existing web workflows and account/billing requirements. Reuse existing features and backend.
6. **Customer beta:** test signup, login, payment, access, saved records across devices, cancellation, failure recovery, and the main sports workflows before accepting public customers.

## Remaining verification

No authenticated production data requests, customer changes, payments, deployment changes, or device visual QA were performed. Regression tests do not establish model accuracy, profitability, or commercial data permissions. Current-season provider access, actual quote availability, distribution requirements, data redistribution permissions, and model validation need separate evidence before launch claims.

November remains a target rather than a confirmed release date. The next implementation task is the customer identity and persistence foundation, after checking the chosen service and distribution requirements.
