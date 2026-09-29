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

    /// A date-only voucher is read on the local calendar: "2026-09-30" is
    /// September 30 here, whatever UTC says.
    var expirationDate: Date? {
        guard let expiration else { return nil }
        if expiration.contains("T") {
            return ISO8601DateFormatter().date(from: expiration)
        }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(expiration.prefix(10)))
    }

    /// Whole days from `now` to expiry, 0 on the last day, nil once it has passed.
    /// Takes the timeline entry's date, not `Date()`: WidgetKit renders future
    /// entries ahead of time.
    func daysUntilExpiration(from now: Date) -> Int? {
        guard let expirationDate else { return nil }
        if expiration?.contains("T") == true, expirationDate <= now { return nil }
        let calendar = Calendar.current
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: now),
            to: calendar.startOfDay(for: expirationDate)
        ).day
        guard let days, days >= 0 else { return nil }
        return days
    }
}

struct WidgetPayload: Codable {
    let activeCouponsCount: Int
    let oneTimeCouponsCount: Int
    let totalRemainingValue: Double
    let coupons: [WidgetCoupon]
    let urgentCoupon: WidgetCoupon?
    let urgentDaysRemaining: Int?
    /// Coupons expiring within the month, soonest first. The scene is derived
    /// from their dates at render time, so it moves on without the app.
    let upcoming: [WidgetCoupon]?
    let mascotTier: Int?
    let expiringCount: Int?
    /// publicIds of every coupon expiring within the week — the widget tap opens
    /// the coupons list filtered to exactly these.
    let expiringIds: [String]?
    /// Non-nil forces a celebration scene on the small widget (e.g. "anniversary").
    let celebration: String?
    /// The celebration headline, already filled in with the user's own numbers.
    let celebrationText: String?
    /// ISO instant the celebration comes down (a redemption ends at midnight,
    /// Israel time). Checked here so the scene ends even if the app stays shut.
    let celebrationUntil: String?

    var celebrationEndDate: Date? {
        guard let celebrationUntil else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: celebrationUntil) ?? ISO8601DateFormatter().date(from: celebrationUntil)
    }

    /// The celebration to draw at `date`, or nil once it has ended.
    func activeCelebration(at date: Date) -> String? {
        guard let celebration else { return nil }
        if let end = celebrationEndDate, date >= end { return nil }
        return celebration
    }

    static let empty = WidgetPayload(
        activeCouponsCount: 0,
        oneTimeCouponsCount: 0,
        totalRemainingValue: 0,
        coupons: [],
        urgentCoupon: nil,
        urgentDaysRemaining: nil,
        upcoming: [],
        mascotTier: 1,
        expiringCount: 0,
        expiringIds: [],
        celebration: nil,
        celebrationText: nil,
        celebrationUntil: nil
    )
}

enum SharedStore {
    static func read() -> WidgetPayload {
        guard let defaults = UserDefaults(suiteName: couponWidgetAppGroup),
              let json = defaults.string(forKey: couponWidgetDataKey),
              let data = json.data(using: .utf8)
        else {
            return .empty
        }
        do {
            return try JSONDecoder().decode(WidgetPayload.self, from: data)
        } catch {
            print("[CouponWidget] SharedStore decode error: \(error)")
            return .empty
        }
    }
}
