import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Design tokens
//
// Mirrors `src/lib/theme.ts` ("Coupon Master - Redesign"). The widget wears the
// app's dark chrome rather than its light body: a home-screen tile has to stay
// legible over an arbitrary wallpaper.

private enum WidgetStyle {
    /// `palette.headerBg` — the chrome colour the app uses in both modes.
    static let chrome = Color(red: 0x15/255, green: 0x20/255, blue: 0x2e/255)
    /// `palette.primary`
    static let primary = Color(red: 0x1f/255, green: 0x6f/255, blue: 0xd1/255)
    /// `palette.primaryDark`
    static let primaryDark = Color(red: 0x15/255, green: 0x4a/255, blue: 0x8f/255)
    /// `palette.primaryLight` — the code text, which needs contrast on dark.
    static let primaryLight = Color(red: 0x5b/255, green: 0x9b/255, blue: 0xd8/255)
    /// `palette.lightTextSubtle`
    static let textSubtle = Color(red: 0x98/255, green: 0xa2/255, blue: 0xb3/255)
    /// `palette.warning` — expiry alert face.
    static let warning = Color(red: 0xf5/255, green: 0x9e/255, blue: 0x0b/255)
    static let warningDeep = Color(red: 0xb4/255, green: 0x53/255, blue: 0x09/255)

    static let cardFill = Color.white.opacity(0.06)
    static let cardStroke = Color.white.opacity(0.10)
    static let codeFill = Color(red: 0x1f/255, green: 0x6f/255, blue: 0xd1/255).opacity(0.18)
    static let codeStroke = Color(red: 0x5b/255, green: 0x9b/255, blue: 0xd8/255).opacity(0.35)

    static var background: LinearGradient {
        LinearGradient(
            gradient: Gradient(stops: [
                .init(color: chrome, location: 0.0),
                .init(color: Color(red: 0x1b/255, green: 0x2a/255, blue: 0x3d/255), location: 0.55),
                .init(color: chrome, location: 1.0)
            ]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var alertGradient: LinearGradient {
        LinearGradient(
            gradient: Gradient(colors: [warning, warningDeep]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

/// Heebo weights bundled with the target (see `UIAppFonts` in Info.plist).
private enum HeeboWeight: String {
    case regular = "Heebo-Regular"
    case medium = "Heebo-Medium"
    case bold = "Heebo-Bold"
    case extraBold = "Heebo-ExtraBold"
}

private extension View {
    @ViewBuilder
    func widgetBackground(_ backgroundView: some View) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { backgroundView }
        } else {
            background(backgroundView)
        }
    }

    /// Custom fonts do not scale with Dynamic Type on their own, so pair
    /// `.custom(_:size:)` with a relative text style.
    func couponFont(_ size: CGFloat, _ weight: HeeboWeight = .regular) -> some View {
        font(.custom(weight.rawValue, size: size))
    }
}

/// Formats an amount: ₪ on the left, no space, grouped digits.
private func formatShekels(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = 0
    formatter.groupingSeparator = ","
    let number = formatter.string(from: NSNumber(value: value.rounded())) ?? "0"
    return "₪\(number)"
}

/// Wraps a coupon code onto at most 4 balanced lines.
///
/// The original broke every 10 characters, which left a 12-character code as
/// 10 + 2 and read as truncated. Splitting into even chunks keeps the block
/// rectangular at any length. Must stay in sync with the Android version.
private func formatCouponCode(_ code: String) -> String {
    let characters = Array(code)
    guard characters.count > 10 else { return code }

    let lineCount = min(4, Int(ceil(Double(characters.count) / 10.0)))
    let perLine = Int(ceil(Double(characters.count) / Double(lineCount)))

    return stride(from: 0, to: characters.count, by: perLine)
        .map { String(characters[$0..<min($0 + perLine, characters.count)]) }
        .joined(separator: "\n")
}

// MARK: - Timeline

struct CouponEntry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload
}

struct CouponProvider: TimelineProvider {
    private let refreshIntervalMinutes = 10

    func placeholder(in context: Context) -> CouponEntry {
        CouponEntry(date: Date(), payload: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (CouponEntry) -> Void) {
        completion(CouponEntry(date: Date(), payload: SharedStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CouponEntry>) -> Void) {
        let now = Date()
        let entry = CouponEntry(date: now, payload: SharedStore.read())
        let next = Calendar.current.date(byAdding: .minute, value: refreshIntervalMinutes, to: now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Company logo

private struct CompanyLogoView: View {
    let company: String
    let logoFile: String?
    var size: CGFloat = 48

    /// Read from the shared container rather than the network: a widget cannot
    /// fetch synchronously while rendering, and the app has already put the
    /// file here. See `src/lib/widgetLogos.ts`.
    private var image: UIImage? {
        guard let logoFile, FileManager.default.fileExists(atPath: logoFile) else { return nil }
        return UIImage(contentsOfFile: logoFile)
    }

    var body: some View {
        ZStack {
            if let uiImage = image {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .accessibilityHidden(true)
            } else {
                Circle().fill(WidgetStyle.codeFill)
                Text(String(company.prefix(2).uppercased()))
                    .couponFont(size / 3, .bold)
                    .foregroundColor(WidgetStyle.primaryLight)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

private struct AppLogoView: View {
    var height: CGFloat = 15

    var body: some View {
        if let uiImage = UIImage(named: "CouponLogo") {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: height)
                .accessibilityHidden(true)
        } else {
            HStack(spacing: 4.5) {
                Text("COUPON")
                    .couponFont(11.5, .extraBold)
                    .foregroundColor(.white)
                    .tracking(1.0)

                Image(systemName: "ticket.fill")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(WidgetStyle.primaryLight)
                    .rotationEffect(.degrees(-15))

                Text("MASTER")
                    .couponFont(11.5, .extraBold)
                    .foregroundColor(WidgetStyle.primaryLight)
                    .tracking(1.0)
            }
            .environment(\.layoutDirection, .leftToRight)
        }
    }
}

// MARK: - Coupon card

private struct CouponCardView: View {
    let coupon: WidgetCoupon
    var compact: Bool = false

    @Environment(\.layoutDirection) private var layoutDirection

    private var couponURL: URL {
        URL(string: "couponmaster:///coupons/\(coupon.publicId ?? String(coupon.id))") ?? URL(string: "couponmaster:///")!
    }

    var body: some View {
        Link(destination: couponURL) {
            HStack(spacing: 12) {
                CompanyLogoView(
                    company: coupon.company,
                    logoFile: coupon.logoFile,
                    size: compact ? 40 : 48
                )

                VStack(alignment: .leading, spacing: compact ? 2 : 3) {
                    Text(coupon.company)
                        .couponFont(compact ? 13 : 15, .bold)
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Text("יתרה: " + formatShekels(coupon.remainingValue))
                        .couponFont(compact ? 10 : 12, .bold)
                        .foregroundColor(.white)

                    if coupon.cardExp != nil || coupon.cvv != nil {
                        HStack(spacing: 5) {
                            if let exp = coupon.cardExp, !exp.isEmpty {
                                Text("תוקף: \(exp)")
                                    .couponFont(compact ? 8 : 9, .medium)
                                    .foregroundColor(WidgetStyle.textSubtle)
                            }
                            if let cvv = coupon.cvv, !cvv.isEmpty {
                                Text("CVV: \(cvv)")
                                    .couponFont(compact ? 8 : 9, .medium)
                                    .foregroundColor(WidgetStyle.textSubtle)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(formatCouponCode(coupon.code))
                    .couponFont(compact ? 9 : 10, .bold)
                    .foregroundColor(WidgetStyle.primaryLight)
                    .lineLimit(4)
                    .minimumScaleFactor(0.6)
                    .multilineTextAlignment(.center)
                    .lineSpacing(1)
                    .padding(.horizontal, compact ? 8 : 10)
                    .padding(.vertical, compact ? 12 : 8)
                    .background(
                        RoundedRectangle(cornerRadius: 15)
                            .fill(WidgetStyle.codeFill)
                            .overlay(
                                RoundedRectangle(cornerRadius: 15)
                                    .stroke(WidgetStyle.codeStroke, lineWidth: 1)
                            )
                    )

                Image(systemName: layoutDirection == .rightToLeft ? "chevron.right" : "chevron.left")
                    .couponFont(12, .bold)
                    .foregroundColor(WidgetStyle.textSubtle)
                    .opacity(0.5)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(WidgetStyle.cardFill)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(WidgetStyle.cardStroke, lineWidth: 1)
                    )
            )
        }
    }
}

// MARK: - Mascot Urgency Model

enum MascotUrgencyTier: Int {
    case normal = 1      // 0 expiring or > 7 days
    case approaching = 2 // 5-7 days
    case warning = 3     // 2-4 days
    case urgent = 4      // 1 day (tomorrow)
    case critical = 5    // 0 days (today)

    var imageName: String {
        "MascotState\(rawValue)"
    }

    var badgeTitle: String {
        switch self {
        case .critical: return "פג היום!"
        case .urgent: return "פג מחר!"
        case .warning: return "דחיפות עולה"
        case .approaching: return "מתקרב"
        case .normal: return "הכל תקין"
        }
    }

    var badgeColor: Color {
        switch self {
        case .critical: return Color(red: 0xef/255, green: 0x44/255, blue: 0x44/255)
        case .urgent: return Color(red: 0xf9/255, green: 0x73/255, blue: 0x16/255)
        case .warning: return Color(red: 0xf5/255, green: 0x9e/255, blue: 0x0b/255)
        case .approaching: return Color(red: 0x3b/255, green: 0x82/255, blue: 0xf6/255)
        case .normal: return Color(red: 0x10/255, green: 0xb9/255, blue: 0x81/255)
        }
    }

    var backgroundGradient: LinearGradient {
        switch self {
        case .critical:
            return LinearGradient(
                stops: [
                    .init(color: Color(red: 0x3b/255, green: 0x07/255, blue: 0x07/255), location: 0.0),
                    .init(color: Color(red: 0x88/255, green: 0x13/255, blue: 0x13/255), location: 0.45),
                    .init(color: Color(red: 0xdc/255, green: 0x26/255, blue: 0x26/255), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        case .urgent:
            return LinearGradient(
                stops: [
                    .init(color: Color(red: 0x43/255, green: 0x14/255, blue: 0x07/255), location: 0.0),
                    .init(color: Color(red: 0x9a/255, green: 0x34/255, blue: 0x12/255), location: 0.45),
                    .init(color: Color(red: 0xea/255, green: 0x58/255, blue: 0x0c/255), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        case .warning:
            return LinearGradient(
                stops: [
                    .init(color: Color(red: 0x45/255, green: 0x1a/255, blue: 0x03/255), location: 0.0),
                    .init(color: Color(red: 0x85/255, green: 0x4d/255, blue: 0x0e/255), location: 0.45),
                    .init(color: Color(red: 0xd9/255, green: 0x77/255, blue: 0x06/255), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        case .approaching:
            return LinearGradient(
                stops: [
                    .init(color: Color(red: 0x0f/255, green: 0x17/255, blue: 0x2a/255), location: 0.0),
                    .init(color: Color(red: 0x1e/255, green: 0x29/255, blue: 0x3b/255), location: 0.55),
                    .init(color: Color(red: 0x85/255, green: 0x4d/255, blue: 0x0e/255), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        case .normal:
            return LinearGradient(
                stops: [
                    .init(color: Color(red: 0x0f/255, green: 0x17/255, blue: 0x2a/255), location: 0.0),
                    .init(color: Color(red: 0x1e/255, green: 0x3a/255, blue: 0x8a/255), location: 0.6),
                    .init(color: Color(red: 0x25/255, green: 0x63/255, blue: 0xeb/255), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

@available(iOS 16.0, *)
struct ToggleWidgetFaceIntent: AppIntent {
    static var title: LocalizedStringResource = "החלפת תצוגת ווידג'ט"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        if let defaults = UserDefaults(suiteName: couponWidgetAppGroup) {
            let current = defaults.bool(forKey: "widget_show_stats_face")
            defaults.set(!current, forKey: "widget_show_stats_face")
        }
        return .result()
    }
}

private extension WidgetPayload {
    var mostUrgentCoupon: WidgetCoupon? {
        if let urgent = urgentCoupon {
            return urgent
        }
        return coupons
            .filter { coupon in
                guard let days = coupon.daysUntilExpiration else { return false }
                return days >= 0 && days <= 7
            }
            .sorted { (c1, c2) in
                (c1.daysUntilExpiration ?? 999) < (c2.daysUntilExpiration ?? 999)
            }
            .first
    }

    var mascotUrgencyTier: MascotUrgencyTier {
        if let tierNum = mascotTier, let tier = MascotUrgencyTier(rawValue: tierNum) {
            return tier
        }
        if let days = urgentDaysRemaining {
            if days <= 0 { return .critical }
            if days == 1 { return .urgent }
            if days <= 4 { return .warning }
            if days <= 7 { return .approaching }
            return .normal
        }
        guard let coupon = mostUrgentCoupon, let days = coupon.daysUntilExpiration else {
            return .normal
        }
        if days <= 0 { return .critical }
        if days == 1 { return .urgent }
        if days <= 4 { return .warning }
        if days <= 7 { return .approaching }
        return .normal
    }
}

// MARK: - Small Mascot View (Duolingo Full-Bleed Style)

struct CouponMascotSmallView: View {
    let payload: WidgetPayload
    var isPagedInSmall: Bool = false

    private var tier: MascotUrgencyTier {
        payload.mascotUrgencyTier
    }

    private var urgentCoupon: WidgetCoupon? {
        payload.mostUrgentCoupon
    }

    private var daysLeft: Int {
        payload.urgentDaysRemaining ?? urgentCoupon?.daysUntilExpiration ?? 0
    }

    private var destinationURL: URL {
        if let coupon = urgentCoupon {
            return URL(string: "couponmaster:///coupons/\(coupon.publicId ?? String(coupon.id))") ?? URL(string: "couponmaster:///coupons")!
        }
        return URL(string: "couponmaster:///coupons")!
    }

    var body: some View {
        ZStack(alignment: .top) {
            // Unified Full-Bleed 3D Scene
            Image(tier.imageName)
                .resizable()
                .scaledToFill()
                .edgesIgnoringSafeArea(.all)

            // Subtle top shadow vignette so UI text is razor sharp on any background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.black.opacity(0.45),
                    Color.black.opacity(0.18),
                    Color.clear
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 70)
            .edgesIgnoringSafeArea(.top)

            // Top Header (Duolingo style: Big number + Icon + Subtitle + Glass Chip)
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(tier == .critical ? "🚨" : (tier == .urgent ? "⏳" : (tier == .normal ? "✨" : "🔥")))
                            .font(.system(size: 20))

                        Text(tier == .critical ? "0" : (tier == .normal ? "✓" : "\(daysLeft)"))
                            .couponFont(24, .extraBold)
                            .foregroundColor(.white)
                            .shadow(color: .black.opacity(0.6), radius: 3, x: 0, y: 1)

                        if let coupon = urgentCoupon {
                            HStack(spacing: 3) {
                                Text(coupon.company)
                                    .couponFont(10, .bold)
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                Text("•")
                                    .foregroundColor(.white.opacity(0.7))
                                    .font(.system(size: 8))
                                Text(formatShekels(coupon.remainingValue))
                                    .couponFont(9, .extraBold)
                                    .foregroundColor(.white)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.black.opacity(0.45))
                            .overlay(
                                Capsule().stroke(Color.white.opacity(0.22), lineWidth: 1)
                            )
                            .clipShape(Capsule())
                        }
                    }

                    Text(tier.badgeTitle)
                        .couponFont(11, .bold)
                        .foregroundColor(.white.opacity(0.95))
                        .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
                }

                Spacer(minLength: 0)

                // Interactive page flip button
                if isPagedInSmall, #available(iOS 17.0, *) {
                    Button(intent: ToggleWidgetFaceIntent()) {
                        HStack(spacing: 3) {
                            Circle().fill(Color.white).frame(width: 5, height: 5)
                            Circle().fill(Color.white.opacity(0.35)).frame(width: 5, height: 5)
                            Image(systemName: "chevron.left")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.black.opacity(0.45))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
        }
        .widgetURL(destinationURL)
        .widgetBackground(
            Image(tier.imageName)
                .resizable()
                .scaledToFill()
        )
    }
}

// MARK: - Small Stats View

private struct CouponStatsSmallView: View {
    let payload: WidgetPayload

    private var showStats: Bool {
        UserDefaults(suiteName: couponWidgetAppGroup)?.bool(forKey: "widget_show_stats_face") ?? false
    }

    var body: some View {
        Group {
            if showStats {
                statsView
                    .widgetBackground(WidgetStyle.background)
            } else {
                CouponMascotSmallView(payload: payload, isPagedInSmall: true)
            }
        }
        .widgetURL(URL(string: "couponmaster:///coupons"))
    }

    /// One idea per tile: the money is the hero, everything else is one line of
    /// context under it.
    private var statsView: some View {
        ZStack {
            WidgetStyle.background.edgesIgnoringSafeArea(.all)

            VStack(spacing: 0) {
                HStack {
                    AppLogoView(height: 12)
                        .opacity(0.75)

                    Spacer()

                    if #available(iOS 17.0, *) {
                        Button(intent: ToggleWidgetFaceIntent()) {
                            HStack(spacing: 3) {
                                Circle().fill(Color.white.opacity(0.35)).frame(width: 5, height: 5)
                                Circle().fill(Color.white).frame(width: 5, height: 5)
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(WidgetStyle.primaryLight)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }

                Spacer(minLength: 0)

                Text(formatShekels(payload.totalRemainingValue))
                    .couponFont(34, .extraBold)
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)

                Text("נותר ב־\(payload.activeCouponsCount) קופונים")
                    .couponFont(12, .medium)
                    .foregroundColor(WidgetStyle.textSubtle)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 4)

                Spacer(minLength: 0)

                HStack(spacing: 4) {
                    Text("לכל הקופונים")
                        .couponFont(12, .bold)
                    Image(systemName: "chevron.left")
                        .font(.caption2.weight(.bold))
                }
                .foregroundColor(WidgetStyle.primaryLight)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Medium

private struct CouponMediumView: View {
    let payload: WidgetPayload

    private var couponsToShow: [WidgetCoupon] { Array(payload.coupons.prefix(2)) }

    var body: some View {
        ZStack {
            WidgetStyle.background.edgesIgnoringSafeArea(.all)

            VStack(alignment: .leading, spacing: 8) {
                if couponsToShow.isEmpty {
                    emptyState(text: "בחר עד 2 קופונים")
                } else {
                    Spacer()
                    ForEach(couponsToShow) { coupon in
                        CouponCardView(coupon: coupon)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if couponsToShow.count == 1 {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(WidgetStyle.cardFill)
                            .overlay(
                                Text("בחר קופון נוסף")
                                    .couponFont(12)
                                    .foregroundColor(WidgetStyle.textSubtle)
                            )
                            .frame(maxWidth: .infinity, minHeight: 50)
                    }
                    Spacer()
                }
            }
            .padding()
        }
        .widgetBackground(Color.clear)
    }
}

// MARK: - Large

private struct CouponLargeView: View {
    let payload: WidgetPayload

    var body: some View {
        ZStack {
            WidgetStyle.background.edgesIgnoringSafeArea(.all)

            VStack(spacing: 4) {
                HStack(spacing: 12) {
                    AppLogoView(height: 20)

                    VStack(alignment: .center, spacing: 2) {
                        Text("קופונים פעילים: \(payload.activeCouponsCount)")
                            .couponFont(14, .bold)
                            .foregroundColor(.white)

                        Text("יתרה: " + formatShekels(payload.totalRemainingValue))
                            .couponFont(14, .medium)
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)

                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)

                Rectangle()
                    .fill(WidgetStyle.cardStroke)
                    .frame(height: 1)
                    .padding(.horizontal, 8)
                    .padding(.bottom, 8)

                VStack(spacing: 10) {
                    if payload.coupons.isEmpty {
                        emptyState(text: "אין קופונים פעילים")
                    } else {
                        ForEach(payload.coupons) { coupon in
                            CouponCardView(coupon: coupon, compact: true)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
            .padding(.top, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .widgetBackground(Color.clear)
    }
}

@ViewBuilder
private func emptyState(text: String) -> some View {
    VStack(spacing: 6) {
        Image(systemName: "square.and.arrow.down.on.square")
            .couponFont(18)
        Text(text)
            .couponFont(13)
            .multilineTextAlignment(.center)
    }
    .foregroundColor(WidgetStyle.textSubtle)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
}

// MARK: - Entry point

struct CouponWidgetEntryView: View {
    var entry: CouponProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            switch family {
            case .systemMedium: CouponMediumView(payload: entry.payload)
            case .systemLarge: CouponLargeView(payload: entry.payload)
            default: CouponStatsSmallView(payload: entry.payload)
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
    }
}

struct CouponMascotEntryView: View {
    var entry: CouponProvider.Entry

    var body: some View {
        CouponMascotSmallView(payload: entry.payload)
            .environment(\.layoutDirection, .rightToLeft)
    }
}

@main
struct CouponWidgetsBundle: WidgetBundle {
    var body: some Widget {
        CouponWidget()
        CouponMascotWidget()
    }
}

struct CouponWidget: Widget {
    let kind = "CouponWidget"

    var body: some WidgetConfiguration {
        let config = StaticConfiguration(kind: kind, provider: CouponProvider()) { entry in
            CouponWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("ניהול קופונים")
        .description("עקוב אחר הקופונים שלך ותאריכי התפוגה")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])

        if #available(iOSApplicationExtension 17.0, *) {
            return config.contentMarginsDisabled()
        } else {
            return config
        }
    }
}

struct CouponMascotWidget: Widget {
    let kind = "CouponMascotWidget"

    var body: some WidgetConfiguration {
        let config = StaticConfiguration(kind: kind, provider: CouponProvider()) { entry in
            CouponMascotEntryView(entry: entry)
        }
        .configurationDisplayName("מאסקט התראת תפוגה")
        .description("מאסקט שממריץ לפעולה לפני שקופון מסתיים (בסגנון Duolingo)")
        .supportedFamilies([.systemSmall])

        if #available(iOSApplicationExtension 17.0, *) {
            return config.contentMarginsDisabled()
        } else {
            return config
        }
    }
}
