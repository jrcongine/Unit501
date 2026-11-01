# Unit 501 release decision · November 1, 2026

Keep private access enabled. The existing owner login protects the app. It supplies one identity for the entire service. It cannot isolate paying customers or revoke one subscription.

## First visit

Choose NFL, CFB, NBA or CBB, select the date, then open a matchup. Overview shows the teams and available market context. Simulation shows the model estimate. Open Player Props, choose a player and compare the quoted line with the projection. A difference is measured in the units of that stat. The median is the middle historical result. Review the sample size before using an Above or Below rate. A push lands exactly on the comparison line. A player who participated can record zero. Missing history or an unavailable quote may leave a comparison blank. War Room shows picks from the listed sources. Model outputs and source votes can disagree.

## Support procedure

Ask for the league, game, date, player or market, displayed source time and a screenshot with personal details removed. For a missing quote, compare the source response and parser counts with matched and displayed rows for the same event. For a disputed zero, verify participation and the official final stat. For stale reports, check Data Health and quota/cooldown before retrying. Keep unsupported figures unavailable. For sign-in and payment disputes, use account identifiers and provider event IDs. Never request a password or card number. Record the affected scope and verify the customer's original workflow after repair.

## Commercial build specification

Proposed starting offer for review: one monthly all-sport plan. Price, renewal terms, support contact, cancellation timing and refund policy need owner decisions. A private owner login must never double as subscriber access.

1. Provision a distinct authenticated subject for each customer. Store server-side ownership for saved settings and billing mappings. Separate owner operations from customer routes. Verify recovery, logout, session expiry and two-account isolation across every read and write.
2. If Stripe is selected, use its sandbox and hosted checkout. Resolve the price on the server, bind checkout to the signed-in account, and reject live credentials in the test environment. Returning from checkout cannot grant access.
3. Verify webhook signatures against the raw body. Deduplicate provider event IDs transactionally and reconcile current subscription state when delivery order changes. Persist the verified paid-through date. Initial failure leaves access closed. A failed renewal must not extend access. A canceled subscription ends according to the approved policy. Reconcile a successful recovery before restoring access.
4. Exercise initial payment, decline, additional authentication, duplicate and reordered events, cancellation, expiry, recovery and an attempted cross-account portal session in the sandbox. Require durable evidence for every entitlement transition before enabling checkout.
5. Inventory collected data, retention and deletion processes, vendors and support access. Prepare privacy, terms, billing/cancellation and sports-projection disclosures from the actual production behavior. Verify commercial redistribution rights for odds, statistics, analyst content and logos before sale. Obtain owner approval for the published policies and price.

Integration references: https://docs.stripe.com/testing · https://docs.stripe.com/billing/subscriptions/webhooks · https://docs.stripe.com/webhooks

## Outstanding release evidence

- Obtain fresh provider-to-screen traces for a pregame matchup in each league. Reconcile dates, teams, spread sides, totals, moneylines and prop counts with source times and rejection reasons. Preserve representative vendor-omission cases.
- Verify last-opponent coverage beyond basketball's recent-history window, confirmed replacement workload, and real zero, DNP and missing-stat examples across sports.
- Capture pregame predictions and quotes through settlement. Separate observed production outcomes from archive replays. Record uncertainty by market and league. Recheck close-game bias with held-out seasons before changing weights.
- Run authenticated live matchup, player selection and War Room checks across device sizes with populated data, provider failures and recovery. Exercise concurrent customer traffic once isolated test accounts exist.
- Maintain a deployment SHA, production runtime asset result, saved feed coverage, source timestamps and live workflow result as separate release evidence. A successful process startup alone clears only the deployment check.
