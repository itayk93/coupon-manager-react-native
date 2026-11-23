import WidgetKit
import SwiftUI

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
        let payload = SharedStore.read()
        var entries = [CouponEntry(date: now, payload: payload)]
        // A celebration ending before the next refresh gets its own entry, so
        // the scene comes down exactly at its end (midnight for a redemption).
        if payload.celebration != nil, let end = payload.celebrationEndDate, end > now {
            entries.append(CouponEntry(date: end, payload: payload))
        }
        // The scene is derived from expiry dates, so give each coming midnight
        // its own entry: "tomorrow" becomes "today" even if the app stays shut
        // and WidgetKit's reload budget runs out.
        let calendar = Calendar.current
        var midnight = calendar.startOfDay(for: now)
        for _ in 0..<8 {
            midnight = calendar.date(byAdding: .day, value: 1, to: midnight)!
            entries.append(CouponEntry(date: midnight, payload: payload))
        }
        entries.sort { $0.date < $1.date }
        let next = Calendar.current.date(byAdding: .minute, value: refreshIntervalMinutes, to: now)!
        completion(Timeline(entries: entries, policy: .after(next)))
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
        if let uiImage = UIImage(named: "KuponiWordmarkWhite") {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: max(height, 20))
                .accessibilityHidden(true)
        } else {
            Text("קופון מאסטר")
                .couponFont(11.5, .extraBold)
                .foregroundColor(.white)
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

                    Text(coupon.worthText ?? "יתרה: " + formatShekels(coupon.remainingValue))
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
                    .padding(.vertical, compact ? 6 : 8)
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

// Each scene is a finished illustration with its own baked-in Hebrew headline
// ("היום", "מחר", "יומיים", "3 ימים" … "7 ימים"), so the widget just picks the
// one that matches how many days are left. Today uses native headline/company text.
// The calm scene (MascotState1) is the exception — it carries no text, so the
// widget draws the logo and the wallet balance over it.
enum MascotScene {
    /// Asset name for the scene matching the days left, or the calm scene when
    /// nothing is expiring inside the week.
    static func imageName(daysLeft days: Int?) -> String {
        guard let days, days >= 0, days <= 7 else { return "MascotState1" }
        switch days {
        case 0: return "MascotState9"   // היום
        case 1: return "MascotState8"   // מחר
        case 2: return "MascotState7"   // יומיים
        case 3: return "MascotState6"   // 3 ימים
        case 4: return "MascotState5"   // 4 ימים
        case 5: return "MascotState4"   // 5 ימים
        case 6: return "MascotState3"   // 6 ימים
        default: return "MascotState2"  // 7 ימים
        }
    }

    static func isCalm(daysLeft days: Int?) -> Bool {
        guard let days else { return true }
        return days < 0 || days > 7
    }
}

private extension WidgetPayload {
    /// The soonest coupon still inside the week at `date`, with its days left.
    /// `urgentCoupon` covers payloads written before `upcoming` existed; the
    /// picked coupons are checked too, as before.
    func mostUrgent(at date: Date) -> (coupon: WidgetCoupon, days: Int)? {
        let candidates = (upcoming ?? []) + [urgentCoupon].compactMap { $0 } + coupons
        return candidates
            .compactMap { coupon in
                coupon.daysUntilExpiration(from: date).flatMap { $0 <= 7 ? (coupon, $0) : nil }
            }
            .min { $0.1 < $1.1 }
    }

    /// A celebration yields to a coupon expiring within two days, matching
    /// `pickScene` in the app. Checked at render time too: a scene written days
    /// ago must not hide "tomorrow" once the date has caught up with it.
    func showsCelebration(at date: Date) -> Bool {
        guard activeCelebration(at: date) != nil else { return false }
        return (mostUrgent(at: date)?.days ?? Int.max) > 2
    }
}

// MARK: - Small Mascot View
//
// Expiring: just the matching scene, nothing drawn on top — the illustration
// already says everything. Calm: the calm scene with the logo and the wallet
// balance over it.

struct CouponMascotSmallView: View {
    let payload: WidgetPayload
    let date: Date

    @Environment(\.widgetRenderingMode) private var renderingMode

    private var urgent: (coupon: WidgetCoupon, days: Int)? {
        payload.mostUrgent(at: date)
    }

    private var daysLeft: Int? {
        urgent?.days
    }

    private var isCalm: Bool {
        MascotScene.isCalm(daysLeft: daysLeft)
    }

    private func expiryHeadline(days: Int) -> String {
        switch days {
        case ...0: return "בתוקף עד היום"
        case 1: return "בתוקף עד מחר"
        case 2: return "בתוקף עוד יומיים"
        case 3...7: return "בתוקף עוד \(days) ימים"
        default: return "בתוקף עוד שבוע"
        }
    }

    /// Opens the coupons list filtered to exactly the expiring coupons — all of
    /// them when several are close, just the one when only one is.
    private var destinationURL: URL {
        if let coupon = urgent?.coupon {
            return URL(string: "couponmaster:///coupons/\(coupon.publicId ?? String(coupon.id))")
                ?? URL(string: "couponmaster:///coupons")!
        }
        let ids = (payload.expiringIds ?? []).filter { !$0.isEmpty }
        if !ids.isEmpty {
            return URL(string: "couponmaster:///coupons?ids=\(ids.joined(separator: ","))")
                ?? URL(string: "couponmaster:///coupons")!
        }
        return URL(string: "couponmaster:///coupons")!
    }

    var body: some View {
        ZStack(alignment: .top) {
            background

            if let days = daysLeft, days >= 0 && days <= 7 {
                let isExtendedDays = days >= 3
                VStack {
                    VStack(spacing: isExtendedDays ? 2.5 : 0) {
                        AppLogoView(height: isExtendedDays ? 14 : 11.5)
                        Text(expiryHeadline(days: days))
                            .couponFont(16, .bold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                    .padding(.top, isExtendedDays ? 10.5 : 8.5)
                    Spacer()
                    if let coupon = urgent?.coupon {
                        let company = coupon.company.trimmingCharacters(in: .whitespacesAndNewlines)
                        let amount = coupon.remainingValue.formatted(.number.precision(.fractionLength(0...2)))
                        Text(coupon.worthText.map { "\(company) · \($0)" } ?? "\(company) · יתרה \u{2066}₪\(amount)\u{2069}")
                            .couponFont(12, .medium)
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.65)
                            .padding(.bottom, 4)
                    }
                }
                .shadow(color: .black.opacity(0.75), radius: 3, x: 0, y: 1)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, 14)
            }

            if isCalm {
                VStack {
                    Spacer()
                    LinearGradient(
                        colors: [
                            .clear,
                            .black.opacity(0.22),
                            .black.opacity(0.34)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 58)
                }
                .edgesIgnoringSafeArea(.bottom)

                // Kept tight to the top edge: the calm mascot's head sits just
                // below, and the balance must not touch it.
                VStack(alignment: .center, spacing: -2) {
                    AppLogoView(height: 15)
                        .opacity(0.95)
                    Text(formatShekels(payload.totalRemainingValue))
                        .couponFont(21, .medium)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                .shadow(color: .black.opacity(0.55), radius: 3, x: 0, y: 1)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.horizontal, 14)
                .padding(.top, 7)

                VStack {
                    Spacer()
                    Text("\(payload.activeCouponsCount) קופונים בארנק")
                        .couponFont(14, .regular)
                        .foregroundColor(.white.opacity(0.9))
                        .multilineTextAlignment(.center)
                        .shadow(color: .black.opacity(0.75), radius: 5, x: 0, y: 2)
                        .shadow(color: .black.opacity(0.35), radius: 1, x: 0, y: 0)
                        .padding(.bottom, 12)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, 14)
            }
        }
        .widgetURL(destinationURL)
        // Artwork is already drawn in the ZStack. Keep the container cheap and
        // opaque; a second full-size image doubles the widget render workload.
        .widgetBackground(WidgetStyle.chrome)
    }

    @ViewBuilder
    private var background: some View {
        if renderingMode == .fullColor {
            Image(MascotScene.imageName(daysLeft: daysLeft))
                .resizable()
                .scaledToFill()
                .edgesIgnoringSafeArea(.all)
        } else {
            // Tinted / transparent home screen: a photo would wash out, so fall
            // back to the flat chrome the rest of the widget already uses.
            WidgetStyle.chrome.edgesIgnoringSafeArea(.all)
        }
    }
}

// MARK: - Merchant-card widgets (medium and large only)

private struct MerchantCardView: View {
    let coupon: WidgetCoupon
    let index: Int
    let date: Date
    var compact: Bool = false

    private var darkInk: Bool { index % 4 != 0 }
    private var ink: Color { darkInk ? WidgetStyle.chrome : .white }
    private var fill: Color {
        switch index % 4 {
        case 0: return Color(red: 0.72, green: 0.25, blue: 0.15)
        case 1: return Color(red: 0.59, green: 0.66, blue: 0.93)
        case 2: return Color(red: 0.65, green: 0.83, blue: 0.74)
        default: return Color(red: 0.96, green: 0.91, blue: 0.82)
        }
    }
    private var destination: URL {
        URL(string: "couponmaster:///coupons/\(coupon.publicId ?? String(coupon.id))")
            ?? URL(string: "couponmaster:///coupons")!
    }

    private var codeText: String {
        let characters = Array(coupon.code)
        let lines = max(1, min(4, Int(ceil(Double(characters.count) / 12.0))))
        let perLine = max(1, Int(ceil(Double(characters.count) / Double(lines))))
        return stride(from: 0, to: characters.count, by: perLine)
            .map { String(characters[$0..<min($0 + perLine, characters.count)]) }
            .joined(separator: "\n")
    }
    private var denseCode: Bool { coupon.code.count > 24 }
    private var compactHeader: Bool { compact || denseCode }
    private var codeSize: CGFloat {
        denseCode ? (compact ? 9 : 12) : (compact ? 14 : 16)
    }

    var body: some View {
        Link(destination: destination) {
            VStack(alignment: .leading, spacing: compact ? 2 : 3) {
                if compactHeader {
                    HStack(alignment: .center, spacing: 4) {
                        if denseCode, let days = coupon.daysUntilExpiration(from: date), days <= 7 {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.yellow)
                        } else {
                            CompanyLogoView(company: coupon.company, logoFile: coupon.logoFile, size: 16)
                        }
                        Text(coupon.company)
                            .couponFont(11, .bold)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                        Spacer(minLength: 2)
                        if coupon.worthText == nil {
                            Text(formatShekels(coupon.remainingValue))
                                .couponFont(denseCode && compact ? 14 : 18, .extraBold)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .environment(\.layoutDirection, .leftToRight)
                        }
                    }
                    if let purpose = coupon.worthText {
                        Text(purpose).couponFont(12, .bold).lineLimit(1)
                    }
                } else {
                    HStack(spacing: 5) {
                        CompanyLogoView(company: coupon.company, logoFile: coupon.logoFile, size: compact ? 18 : 22)
                        Text(coupon.company)
                            .couponFont(compact ? 11 : 12, .bold)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                    }
                    if let purpose = coupon.worthText {
                        Text(purpose)
                            .couponFont(17, .bold)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    } else {
                        Text(formatShekels(coupon.remainingValue))
                            .couponFont(compact ? 22 : 27, .extraBold)
                            .lineLimit(1)
                            .minimumScaleFactor(0.65)
                            .environment(\.layoutDirection, .leftToRight)
                    }
                }
                Spacer(minLength: 0)
                if !denseCode, let days = coupon.daysUntilExpiration(from: date), days <= 7 {
                    Text(days == 0 ? "בתוקף עד היום" : "נותרו \(days) ימים")
                        .couponFont(10, .bold)
                        .foregroundColor(.yellow)
                        .padding(.horizontal, 5)
                        .background(Capsule().fill(WidgetStyle.chrome))
                        .lineLimit(1)
                }
                Text(codeText)
                    .font(.system(size: codeSize, weight: .bold, design: .monospaced))
                    .environment(\.layoutDirection, .leftToRight)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(1)
                    .lineLimit(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .minimumScaleFactor(0.8)
                    .layoutPriority(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if coupon.cardExp?.isEmpty == false || coupon.cvv?.isEmpty == false {
                    Text([coupon.cardExp.map { "תוקף: \($0)" }, coupon.cvv.map { "CVV: \($0)" }]
                        .compactMap { $0 }.joined(separator: " · "))
                        .couponFont(denseCode && compact ? 8 : 10, .medium)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            .foregroundColor(ink)
            .padding(denseCode ? (compact ? 4 : 6) : (compact ? 6 : 10))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 17).fill(fill))
        }
    }
}

private struct MerchantWidgetView: View {
    let payload: WidgetPayload
    let date: Date
    var large: Bool
    private var selected: [WidgetCoupon] { Array(payload.coupons.prefix(large ? 4 : 2)) }

    var body: some View {
        VStack(spacing: large ? 10 : 7) {
            if large {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("בארנק שלך")
                            .couponFont(14, .medium)
                            .foregroundColor(.white.opacity(0.85))
                        Text(formatShekels(payload.totalRemainingValue))
                            .couponFont(30, .bold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .environment(\.layoutDirection, .leftToRight)
                        Text("\(payload.activeCouponsCount) קופונים")
                            .couponFont(11, .medium)
                            .foregroundColor(WidgetStyle.textSubtle)
                    }
                    .layoutPriority(1)
                    Spacer(minLength: 0)
                    AppLogoView(height: 15).opacity(0.8).padding(.top, 2)
                }
            } else {
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .firstTextBaseline, spacing: 7) {
                            Text("בארנק שלך")
                                .couponFont(13, .medium)
                                .foregroundColor(.white.opacity(0.85))
                            Text(formatShekels(payload.totalRemainingValue))
                                .couponFont(21, .bold)
                                .foregroundColor(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .environment(\.layoutDirection, .leftToRight)
                        }
                        Text("\(payload.activeCouponsCount) קופונים")
                            .couponFont(11, .medium)
                            .foregroundColor(WidgetStyle.textSubtle)
                    }
                    .layoutPriority(1)
                    Spacer(minLength: 0)
                    AppLogoView(height: 15).opacity(0.8).padding(.top, 2)
                }
            }
            if selected.isEmpty {
                emptyState(text: "בחר קופונים להצגה באפליקציה")
            } else {
                // Explicit rows give every card equal height, including 1/3-card selections.
                VStack(spacing: 8) {
                    HStack(spacing: 8) {
                        MerchantCardView(coupon: selected[0], index: 0, date: date, compact: !large)
                        if selected.count > 1 {
                            MerchantCardView(coupon: selected[1], index: 1, date: date, compact: !large)
                        } else { placeholder }
                    }
                    if large {
                        HStack(spacing: 8) {
                            if selected.count > 2 {
                                MerchantCardView(coupon: selected[2], index: 2, date: date, compact: !large)
                            } else { placeholder }
                            if selected.count > 3 {
                                MerchantCardView(coupon: selected[3], index: 3, date: date, compact: !large)
                            } else { placeholder }
                        }
                    }
                }
            }
            if large, let days = payload.mostUrgent(at: date)?.days {
                Text(days == 0 ? "קופון בתוקף עד היום" : "קופון פג בשבוע הקרוב")
                    .couponFont(10)
                    .foregroundColor(WidgetStyle.warning)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(12)
        .widgetBackground(WidgetStyle.background)
    }

    private var placeholder: some View {
        Link(destination: URL(string: "couponmaster:///coupons")!) {
            Text("בחר קופון נוסף")
                .couponFont(12)
                .foregroundColor(WidgetStyle.textSubtle)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(RoundedRectangle(cornerRadius: 17).fill(WidgetStyle.cardFill))
        }
    }
}

private struct CouponMediumView: View {
    let payload: WidgetPayload
    let date: Date
    var body: some View { MerchantWidgetView(payload: payload, date: date, large: false) }
}

private struct CouponLargeView: View {
    let payload: WidgetPayload
    let date: Date
    var body: some View { MerchantWidgetView(payload: payload, date: date, large: true) }
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

// MARK: - Celebration
//
// A milestone scene (anniversary, savings, …) forced onto the small widget. The
// illustration carries the mood; the widget draws the logo and a headline on top.

enum CelebrationScene {
    static func assetName(_ kind: String) -> String {
        switch kind {
        case "six-seven": return "MascotCelebration67"
        case "redeemed": return "MascotCelebrationC3"
        case "anniversary": return "MascotCelebrationC1"
        case "milestone": return "MascotCelebrationC2"
        case "savings": return "MascotCelebrationC3"
        case "monthly": return "MascotCelebrationC4"
        case "streak": return "MascotCelebrationC5"
        case "rescue": return "MascotCelebrationC6"
        case "clean": return "MascotCelebrationC7"
        case "referral": return "MascotCelebrationC8"
        case "record": return "MascotCelebrationC9"
        default: return "MascotCelebrationC1"
        }
    }

    static func headline(_ kind: String) -> String {
        switch kind {
        case "six-seven": return "67 קופונים!"
        case "redeemed": return "מימשת קופון!"
        case "anniversary": return "שנה ביחד! 🎉"
        case "milestone": return "אבן דרך חדשה!"
        case "savings": return "כמה שחסכת!"
        case "monthly": return "החיסכון החודשי שלך"
        case "streak": return "רצף מנצח!"
        case "rescue": return "הצלה ברגע האחרון!"
        case "clean": return "חודש נקי!"
        case "referral": return "חבר הצטרף!"
        case "record": return "שיא חדש בארנק!"
        default: return "מזל טוב!"
        }
    }
}

struct CouponCelebrationSmallView: View {
    let payload: WidgetPayload

    @Environment(\.widgetRenderingMode) private var renderingMode

    private var kind: String { payload.celebration ?? "anniversary" }

    /// The app fills the headline in with real numbers; the baked-in string is
    /// only a fallback for a payload written by an older build.
    private var headline: String {
        let text = payload.celebrationText?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let text, !text.isEmpty { return text }
        return CelebrationScene.headline(kind)
    }

    /// "top\nbottom": the first line goes above the mascot, the rest below it.
    private var headlineParts: (top: String, bottom: String?) {
        // The 67 scene keeps the mascot's face clear: its whole line goes below.
        if kind == "six-seven" { return ("", headline) }
        let lines = headline.split(separator: "\n", maxSplits: 1).map {
            $0.trimmingCharacters(in: .whitespaces)
        }
        let bottom = lines.count > 1 && !lines[1].isEmpty ? lines[1] : nil
        return (lines.first ?? headline, bottom)
    }

    /// Money milestones belong on the statistics screen — that is where the
    /// number the headline just quoted is broken down.
    private var destinationURL: URL {
        let path: String
        switch kind {
        case "redeemed", "rescue", "savings", "monthly", "milestone": path = "statistics"
        case "referral": path = "referral-program"
        default: path = ""
        }
        return URL(string: "couponmaster:///\(path)") ?? URL(string: "couponmaster:///")!
    }

    var body: some View {
        ZStack(alignment: .top) {
            if renderingMode == .fullColor {
                Image(CelebrationScene.assetName(kind))
                    .resizable()
                    .scaledToFill()
                    .edgesIgnoringSafeArea(.all)
            } else {
                WidgetStyle.chrome.edgesIgnoringSafeArea(.all)
            }

            VStack(spacing: 2) {
                AppLogoView(height: 12)
                if !headlineParts.top.isEmpty {
                    Text(headlineParts.top)
                        .couponFont(16, .bold)
                        .foregroundColor(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.6)
                }
                Spacer(minLength: 0)
                // A second headline line (e.g. the wallet total) sits under the
                // mascot so the scene stays visible between the two.
                if let bottom = headlineParts.bottom {
                    Text(bottom)
                        .couponFont(16, .bold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.6)
                }
            }
            .padding(.top, 9)
            .padding(.bottom, 3)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .shadow(color: .black.opacity(0.75), radius: 3, x: 0, y: 1)
        }
        .widgetURL(destinationURL)
        .widgetBackground(WidgetStyle.chrome)
    }
}

// MARK: - Entry point

struct CouponWidgetEntryView: View {
    var entry: CouponProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            switch family {
            case .systemMedium: CouponMediumView(payload: entry.payload, date: entry.date)
            case .systemLarge: CouponLargeView(payload: entry.payload, date: entry.date)
            default:
                if entry.payload.showsCelebration(at: entry.date) {
                    CouponCelebrationSmallView(payload: entry.payload)
                } else {
                    CouponMascotSmallView(payload: entry.payload, date: entry.date)
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
    }
}

struct CouponMascotEntryView: View {
    var entry: CouponProvider.Entry

    var body: some View {
        Group {
            if entry.payload.showsCelebration(at: entry.date) {
                CouponCelebrationSmallView(payload: entry.payload)
            } else {
                CouponMascotSmallView(payload: entry.payload, date: entry.date)
            }
        }
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

#if DEBUG
/// Synthetic-only native previews. No account data or redemption secrets.
struct MerchantWidgetVisualPreviews: PreviewProvider {
    private static func fixture(count: Int, longText: Bool = false, stress: Bool = false) -> WidgetPayload {
        let coupons = (0..<count).map { index in
            WidgetCoupon(
                id: index + 1, publicId: "preview-\(index)",
                company: longText ? "בית עסק לדוגמה עם שם ארוך" : "דוגמה \(index + 1)",
                code: stress ? "DEMO00000000000000000000000000000000000000" : (longText ? "DEMO00000000000000000000000000000000" : "DEMO0000DEMO0000"),
                remainingValue: 240, expiration: stress ? "2099-01-01" : nil, logoFile: nil,
                cardExp: stress ? "01/99" : nil, cvv: stress ? "000" : nil, purpose: nil
            )
        }
        return WidgetPayload(
            activeCouponsCount: 24, oneTimeCouponsCount: 0,
            totalRemainingValue: longText ? 123456 : 3240,
            coupons: coupons, urgentCoupon: nil, urgentDaysRemaining: nil,
            upcoming: nil, mascotTier: nil, expiringCount: nil, expiringIds: nil,
            celebration: nil, celebrationText: nil, celebrationUntil: nil
        )
    }

    static var previews: some View {
        Group {
            MerchantWidgetView(payload: fixture(count: 4), date: Date(), large: true)
                .previewContext(WidgetPreviewContext(family: .systemLarge))
                .previewDisplayName("Large - four synthetic coupons")
            MerchantWidgetView(payload: fixture(count: 2), date: Date(), large: false)
                .previewContext(WidgetPreviewContext(family: .systemMedium))
                .previewDisplayName("Medium - two synthetic coupons")
            MerchantWidgetView(payload: fixture(count: 3, longText: true), date: Date(), large: true)
                .previewContext(WidgetPreviewContext(family: .systemLarge))
                .previewDisplayName("Long names and codes - three coupons")
            MerchantWidgetView(payload: fixture(count: 2, stress: true), date: Date(timeIntervalSince1970: 4_070_916_000), large: false)
                .previewContext(WidgetPreviewContext(family: .systemMedium))
                .previewDisplayName("Stress - four code lines, expiry, CVV, urgency")
            MerchantWidgetView(payload: fixture(count: 4, stress: true), date: Date(timeIntervalSince1970: 4_070_916_000), large: true)
                .previewContext(WidgetPreviewContext(family: .systemLarge))
                .previewDisplayName("Large stress - four code lines and metadata")
            MerchantWidgetView(payload: fixture(count: 0), date: Date(), large: false)
                .previewContext(WidgetPreviewContext(family: .systemMedium))
                .previewDisplayName("Empty selection")
        }
        .environment(\.layoutDirection, .rightToLeft)
    }
}
#endif
