import Foundation

// Keep in sync with `modules/coupon-widget/index.ts` and the Android SharedStore.
let couponWidgetAppGroup = "group.com.itaykarkason.couponmaster"
let couponWidgetDataKey = "CouponWidgetData"

struct WidgetCoupon: Codable, Identifiable {
    let id: Int
    let company: String
    /// Already decrypted by the app — the widget never handles ciphertext.
    let code: String
    let remainingValue: Double
    let expiration: String?
    /// Absolute path to a file the app copied into the App Group container.
    /// The widget cannot reach Metro-bundled assets, so it reads from disk.
    let logoFile: String?

    var expirationDate: Date? {
        guard let expiration else { return nil }
        return ISO8601DateFormatter().date(from: expiration + "T00:00:00Z")
    }
}

struct WidgetPayload: Codable {
    let activeCouponsCount: Int
    let oneTimeCouponsCount: Int
    let totalRemainingValue: Double
    let coupons: [WidgetCoupon]

    static let empty = WidgetPayload(
        activeCouponsCount: 0,
        oneTimeCouponsCount: 0,
        totalRemainingValue: 0,
        coupons: []
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
