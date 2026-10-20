# Unit 501 Pro preparation

Target: $5.99 USD per month, auto-renewable. Product ID proposed as
`com.unit501.pro.monthly`; bundle ID must be assigned in App Store Connect.
Use StoreKit's localized `Product.displayPrice` in the actual paywall, never a
hard-coded dollar string for every storefront.

## Implemented in this draft

- Disabled product catalog and injected Apple signed-transaction verification
  boundary, with account/product/app/environment binding and expiry/refund tests.
- Native StoreKit 2 controller scaffold: product loading, account-token purchase,
  pending/cancel handling, transaction listener, restore, and finish only after
  successful server reconciliation. Purchases default off.
- No subscription HTTP routes or changes to the existing owner authentication.

## Required integration before enabling

1. Create Apple Developer/App Store Connect app and subscription group/product;
   configure the US $5.99 monthly price and sandbox testers. Confirm identifiers.
2. Add authenticated customer sessions and a persisted per-user UUID appAccountToken.
   Never accept the account identity/token from an untrusted request body.
3. Install and pin Apple's official `@apple/app-store-server-library`; configure
   SignedDataVerifier with Apple root certificates, bundle ID, environment and
   production Apple app ID. Run real signed sandbox fixtures, not just our mocks.
4. Store originalTransactionId ownership uniquely, transaction IDs and notification
   UUIDs idempotently in a database. Reject another account claiming an existing
   subscription; apply updates transactionally. Reconcile signed notifications and
   App Store Server API status before enabling access. Never let an older active
   transaction undo a later refund/revocation. Handle grace period using verified
   renewal data; billing retry alone does not extend expired access.
5. Wire authenticated server entitlement checks to each paid API operation. Keep
   quota/rate limits independent of subscription access. Add account deletion,
   recovery, privacy/terms/support URLs and renewal disclosures to the native app.
6. Create an Xcode SwiftUI app target and add `ios/Unit501/SubscriptionStore.swift`.
   Build the native slate/Game Lab, localized paywall, manage/restore controls and
   server entitlement refresh on foreground, restore, updates and logout. Cancel
   the listener on logout; never embed owner credentials or provider keys.
7. Test purchase, renewal, pending approval, cancellation, expiry, grace, refund,
   out-of-order notifications, reinstall/restore, account switching and offline
   recovery in StoreKit testing, sandbox and TestFlight before selling access.

The Swift scaffold has NOT been compiled here: this environment has no Xcode or
Swift toolchain. No IPA, App Store app record or TestFlight release exists from
this change. The Node tests use an injected verifier, not real Apple signatures.

Official references reviewed October 19, 2026:
- https://developer.apple.com/documentation/storekit/transaction
- https://developer.apple.com/documentation/storekit/transaction/currententitlements
- https://developer.apple.com/documentation/storekit/product/purchase(options:)
- https://developer.apple.com/documentation/storekit/transaction/updates
- https://developer.apple.com/documentation/storekit/appstore/sync()
- https://github.com/apple/app-store-server-library-node
