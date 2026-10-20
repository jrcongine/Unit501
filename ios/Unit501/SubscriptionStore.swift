import Foundation
import StoreKit
import Combine

// Integration scaffold, not a complete app target. Keep purchases disabled until
// authenticated server reconciliation, disclosures and sandbox tests are ready.
@MainActor
final class SubscriptionStore: ObservableObject {
    static let productID = "com.unit501.pro.monthly"
    @Published private(set) var product: Product?
    @Published private(set) var message = "Subscriptions are not available yet."
    private let accountToken: UUID
    private let reconcile: (String) async throws -> Void
    private var updates: Task<Void, Never>?
    private let purchasesEnabled: Bool

    init(accountToken: UUID, purchasesEnabled: Bool = false,
         reconcile: @escaping (String) async throws -> Void) {
        self.accountToken = accountToken // Persisted UUID from authenticated server.
        self.purchasesEnabled = purchasesEnabled
        self.reconcile = reconcile // Must durably verify/store before returning success.
    }

    func start() async {
        guard purchasesEnabled else { return }
        updates?.cancel()
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard !Task.isCancelled else { break }
                do { try await self?.accept(result) }
                catch { self?.message = "Purchase verification pending. Try restoring purchases." }
            }
        }
        do {
            product = try await Product.products(for: [Self.productID]).first
            try await refresh()
        } catch { message = "Unable to load subscription. Please try again." }
    }

    func stop() { updates?.cancel(); updates = nil }

    func purchase() async {
        guard purchasesEnabled, let product else { return }
        do {
            switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
            case .success(let result): try await accept(result)
            case .pending: message = "Purchase awaiting approval."
            case .userCancelled: message = "Purchase cancelled."
            @unknown default: message = "Purchase status unavailable."
            }
        } catch { message = "Purchase could not be verified. Please try again." }
    }

    // Invoke only from the user's Restore Purchases button.
    func restore() async {
        guard purchasesEnabled else { return }
        do { try await AppStore.sync(); try await refresh() }
        catch { message = "Unable to restore purchases. Please try again." }
    }

    private func refresh() async throws {
        for await result in Transaction.currentEntitlements {
            try await accept(result)
        }
        // UI access must come from a separate authenticated server entitlement
        // refresh, including when currentEntitlements is empty after expiry/refund.
    }

    private func accept(_ result: VerificationResult<Transaction>) async throws {
        guard case .verified(let transaction) = result else {
            throw SubscriptionError.unverified
        }
        guard transaction.productID == Self.productID else { return }
        guard transaction.appAccountToken == accountToken else {
            throw SubscriptionError.wrongAccount
        }
        try await reconcile(result.jwsRepresentation)
        await transaction.finish()
        message = "Purchase synchronized."
    }

    enum SubscriptionError: Error { case unverified, wrongAccount }
}
