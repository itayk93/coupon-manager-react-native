import Foundation

// Keep in sync with `modules/coupon-widget/index.ts` and the Android SharedStore.
let couponWidgetAppGroup = "group.com.itaykarkason.couponmaster"
let couponWidgetDataKey = "CouponWidgetData"

struct WidgetCoupon: Codable, Identifiable {
    let id: Int
    let publicId: String?
    let company: String
    /// Already decrypted by the app — the widget never handles ciphertext.
    let code: String
    let remainingValue: Double
    let expiration: String?
    /// Absolute path to a file the app copied into the App Group container.
    /// The widget cannot reach Metro-bundled assets, so it reads from disk.
    let logoFile: String?
    let cardExp: String?
    let cvv: String?

    var expirationDate: Date? {
        guard let expiration else { return nil }
        if expiration.contains("T") {
            return ISO8601DateFormatter().date(from: expiration)
        }
        return ISO8601DateFormatter().date(from: expiration + "T00:00:00Z")
    }

    var daysUntilExpiration: Int? {
        guard let expirationDate else { return nil }
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        let startOfExp = calendar.startOfDay(for: expirationDate)
        let components = calendar.dateComponents([.day], from: startOfToday, to: startOfExp)
        return components.day
    }
}

struct WidgetPayload: Codable {
    let activeCouponsCount: Int
    let oneTimeCouponsCount: Int
    let totalRemainingValue: Double
    let coupons: [WidgetCoupon]
    let urgentCoupon: WidgetCoupon?
    let urgentDaysRemaining: Int?
    let mascotTier: Int?

    static let empty = WidgetPayload(
        activeCouponsCount: 0,
        oneTimeCouponsCount: 0,
        totalRemainingValue: 0,
        coupons: [],
        urgentCoupon: nil,
        urgentDaysRemaining: nil,
        mascotTier: 1
    )
}

enum SharedStore {
    static func read() -> WidgetPayload {
        guard let defaults = UserDefaults(suiteName: couponWidgetAppGroup),
              let json = defaults.string(forKey: couponWidgetDataKey),
              let data = json.data(using: .utf8),
              let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data)
        else {
            return .empty
        }
        return payload
    }
}
