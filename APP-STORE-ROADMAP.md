# Unit 501 Pro: App Store launch roadmap

Status: **planning and safeguards**, not yet a public or paid app. Target price **$5.99 USD / month**, subject to App Store pricing and taxes. No subscription processing or public accounts have been implemented.

## Product proposition
A mobile-first sports research and prediction product:
- Football NFL/college: reliable schedules, game lab, matchup analysis, player research, documented Monte Carlo estimates and independently graded forecast history.
- NBA: use a distinct NBA data adapter. Today only schedule, scores and pregame history context are available. Do not market NBA predictions until a calibrated basketball model exists.
- A named `501 War Room`: source-attributed public handicapper opinion, not invented consensus.
- Keep a clear difference between model estimates and independently verified, time-stamped results. **No promised wins or guaranteed returns.**

## Free / Pro tier proposal (subject to testing)
- Free: schedules, basic matchups, sample statistics and limited model previews.
- Pro $5.99/month: additional verified Game Lab and player analysis, forecast/history dashboards, user-saved reports, and eventual NBA research after it is genuinely ready.
- Limits must protect expensive API calls even for paid users; "unlimited" simulations must not mean unlimited third-party API requests.
- Do not collect deposits, take wagers, distribute sportsbook balances, or implement gambling transactions.

## Technical milestones
### 0. API cost and reliability (before inviting anyone)
- Track local outbound football API attempts and provider-reported account-wide remaining daily quota; distinguish the two.
- Preserve quota limits through redeploys by observing upstream headers, and avoid startup bulk crawls.
- Reduce repeated historical lookups; use shared caching, pagination bounds and deduplicated requests.
- Keep provider credentials on server, never in the client or public repository.
- Confirm one real production deployment is used and costs fit the subscription price.
- Establish usage alerts, load tests, and per-account fair-use restrictions before public registration.

### 1. Accounts and persistence
- Replace single-owner HTTP Basic authentication with an audited end-user sign-in system before public release; keep existing private owner gate until the replacement has been tested.
- Store subscriber identities, entitlements, and immutable timestamped forecast records in a managed database.
- Build rate limiting, privacy policy, secure password/account-recovery options, deletion requests and minimal data retention. Never expose secret tokens or user-specific forecasts to other accounts.
- Paid permissions must be checked in the **server**, not merely by hiding browser buttons.

### 2. Apple subscriptions
- Join the Apple Developer Program and create an app record, product IDs and an auto-renewable subscription group in App Store Connect.
- Implement StoreKit 2 purchase, restore, billing failure and cancellation flows; use App Store Server Notifications and server-side verification so access survives reinstall and account changes.
- Clearly disclose renewal terms, price, restore controls, privacy policy and terms; handle App Review expectations.
- Estimate commissions under the applicable Apple terms; model refunds, taxes, API bills, data licensing, hosting and support before deciding the launch economics.

### 3. Dedicated iOS experience
- Evaluate a native SwiftUI front-end or suitable native shell that provides a genuinely useful mobile app experience rather than just an embedded website.
- Reuse the protected Node/JS backend, game adapters and model validations. Keep the current owner web app working while testing iOS builds.
- Create branded screens, loading/error states, accessibility, privacy notices, app icon, screenshots and TestFlight beta.
- Test with several independent accounts, distinct iPhones and poor connectivity.

### 4. Data rights and verified predictive quality
- Verify commercial redistribution, caching and display rights for API-Sports NFL/NCAA/NBA and all third-party odds/prop/pick feeds **before selling access**.
- Backtest probabilities against held-out seasons and market prices; show coverage and uncertainty. Never suggest a trend is true without evidence.
- Test the proposed prime-time star / daytime-upset factors out of sample; **do not auto-double units**.
- Keep NBA schedule/stats separate from football formulas until NBA ratings and basketball simulations are validated.

### 5. Private beta -> public App Store review
- Add end-to-end tests for subscriptions, user authentication, billing expiry, refund, account deletion, API quota depletion and heavy user load.
- Ship a small invited TestFlight beta and monitor provider usage and forecast quality.
- Launch paid only when all cost, licensing, availability, security and App Review gates are passed.

## Current findings (2026-10-19)
- Main live Railway project `humble-amazement` runs `jrcongine/Unit501` with private access and provider keys configured.
- The other Railway project `successful-motivation` deploys the same repository but has **no custom API keys configured** and recorded zero web requests over the inspected 24 hours. Do not delete it until ownership/usage is confirmed.
- API-NFL Pro dashboard previously reported **7,505 / 7,500** daily calls, so the provider quota was really exhausted. App per-process counters alone cannot prove provider usage.
- NBA routes and pages already exist as a separate, experimental schedule/history beta; provider subscription for the production NBA feed is still unverified.
- This roadmap is not itself an App Store submission, StoreKit integration or revenue-generating release.
