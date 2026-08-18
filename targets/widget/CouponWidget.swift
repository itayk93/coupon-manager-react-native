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
    var size: CGFloat = 24

    var body: some View {
        if let uiImage = UIImage(named: "CouponLogo") {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .cornerRadius(size / 4)
        } else {
            // Brand gradient placeholder, matching the app's button/gate treatment.
            ZStack {
                RoundedRectangle(cornerRadius: size / 4)
                    .fill(
                        LinearGradient(
                            colors: [WidgetStyle.primary, WidgetStyle.primaryDark],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: size, height: size)

                Text("%")
                    .couponFont(size / 2, .extraBold)
                    .foregroundColor(.white)
            }
        }
    }
}

// MARK: - Coupon card

private struct CouponCardView: View {
    let coupon: WidgetCoupon
    var compact: Bool = false

    @Environment(\.layoutDirection) private var layoutDirection

    private var couponURL: URL {
        URL(string: "couponmaster:///coupons/\(coupon.id)") ?? URL(string: "couponmaster:///")!
    }

    var body: some View {
        Link(destination: couponURL) {
            HStack(spacing: 12) {
                CompanyLogoView(
                    company: coupon.company,
                    logoFile: coupon.logoFile,
                    size: compact ? 40 : 48
                )

                VStack(alignment: .leading, spacing: compact ? 3 : 4) {
                    Text(coupon.company)
                        .couponFont(compact ? 13 : 15, .bold)
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Text("יתרה: " + formatShekels(coupon.remainingValue))
                        .couponFont(compact ? 10 : 12, .bold)
                        .foregroundColor(.white)
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

// MARK: - Small

private struct CouponStatsSmallView: View {
    let payload: WidgetPayload

    private var expiringThisWeek: [WidgetCoupon] {
        let today = Date()
        let inAWeek = Calendar.current.date(byAdding: .day, value: 7, to: today) ?? today
        return payload.coupons
            .filter { coupon in
                guard let date = coupon.expirationDate else { return false }
                return date >= today && date <= inAWeek
            }
            .sorted { ($0.expirationDate ?? .distantFuture) < ($1.expirationDate ?? .distantFuture) }
    }

    /// The alert face takes over for the first few seconds of each minute, as on the original.
    private var shouldShowExpiringAlert: Bool {
        guard !expiringThisWeek.isEmpty else { return false }
        return Int(Date().timeIntervalSince1970) % 60 < 3
    }

    var body: some View {
        Group {
            if shouldShowExpiringAlert {
                expiringView
            } else {
                statsView
            }
        }
        .widgetBackground(Color.clear)
    }

    private var statsView: some View {
        ZStack {
            WidgetStyle.background.edgesIgnoringSafeArea(.all)

            VStack(spacing: 0) {
                Spacer()
                Spacer()

                VStack(spacing: 8) {
                    AppLogoView(size: 20)
                    Rectangle()
                        .fill(WidgetStyle.cardStroke)
                        .frame(height: 1)
                        .padding(.horizontal, 20)
                }

                HStack {
                    statColumn(label: "חד פעמיים", value: payload.oneTimeCouponsCount)
                    Spacer()
                    statColumn(label: "קופונים פעילים", value: payload.activeCouponsCount)
                }
                .padding(.horizontal, 16)
                .padding(.top, 6)

                Spacer()

                VStack(spacing: 4) {
                    Text(formatShekels(payload.totalRemainingValue))
                        .couponFont(28, .extraBold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    Text("נותר לשימוש")
                        .couponFont(12)
                        .foregroundColor(WidgetStyle.textSubtle)
                }

                Spacer()
                Spacer()
            }
            // The stack fills the tile, so top/bottom breathing room has to be
            // bought by keeping the content itself compact — padding alone just
            // pushes the logo and the footer off the edges.
            .padding(.vertical, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func statColumn(label: String, value: Int) -> some View {
        VStack(alignment: .center, spacing: 2) {
            Text(label)
                .couponFont(9)
                .foregroundColor(WidgetStyle.textSubtle)
            Text("\(value)")
                .couponFont(18, .extraBold)
                .foregroundColor(.white)
        }
    }

    private var expiringView: some View {
        ZStack {
            WidgetStyle.alertGradient.edgesIgnoringSafeArea(.all)

            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .couponFont(16, .bold)
                        .foregroundColor(.white)
                    Text("קופון עומד לפוג תוקף!")
                        .couponFont(12, .bold)
                        .foregroundColor(.white)
                }

                if let first = expiringThisWeek.first {
                    VStack(spacing: 4) {
                        Text(first.company)
                            .couponFont(16, .bold)
                            .foregroundColor(.white)

                        Text(formatShekels(first.remainingValue))
                            .couponFont(24, .extraBold)
                            .foregroundColor(.white)

                        if let date = first.expirationDate {
                            let daysLeft = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
                            Text("נותרו \(daysLeft) ימים")
                                .couponFont(11, .medium)
                                .foregroundColor(.white.opacity(0.9))
                        }
                    }
                }

                Text("מתחלף לסטטיסטיקות...")
                    .couponFont(8)
                    .foregroundColor(WidgetStyle.textSubtle)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(12)
        }
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
                    AppLogoView(size: 32)

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
                .padding(.bottom, 6)
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

@main
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
