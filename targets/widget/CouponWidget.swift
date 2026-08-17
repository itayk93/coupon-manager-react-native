import WidgetKit
import SwiftUI

// MARK: - Style

private enum WidgetStyle {
    static var primaryGradient: LinearGradient {
        LinearGradient(
            gradient: Gradient(stops: [
                .init(color: Color(red: 44/255, green: 63/255, blue: 80/255), location: 0.0),
                .init(color: Color(red: 64/255, green: 83/255, blue: 100/255), location: 0.3),
                .init(color: Color(red: 44/255, green: 63/255, blue: 80/255), location: 1.0)
            ]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var alertGradient: LinearGradient {
        LinearGradient(
            gradient: Gradient(stops: [
                .init(color: Color(red: 220/255, green: 100/255, blue: 60/255), location: 0.0),
                .init(color: Color(red: 240/255, green: 120/255, blue: 80/255), location: 0.3),
                .init(color: Color(red: 220/255, green: 100/255, blue: 60/255), location: 1.0)
            ]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
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

    func couponFont(_ size: CGFloat, weight: Font.Weight = .regular) -> some View {
        font(.system(size: size, weight: weight, design: .rounded))
    }
}

/// Matches the Android `formatCouponCode` — a line break every 10 characters.
private func formatCouponCode(_ code: String) -> String {
    stride(from: 0, to: code.count, by: 10)
        .map { offset -> String in
            let start = code.index(code.startIndex, offsetBy: offset)
            let end = code.index(start, offsetBy: min(10, code.count - offset))
            return String(code[start..<end])
        }
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
    let logoUrl: String?
    var size: CGFloat = 48

    private var image: UIImage? {
        guard let logoUrl,
              let url = URL(string: logoUrl),
              let data = try? Data(contentsOf: url)
        else { return nil }
        return UIImage(data: data)
    }

    var body: some View {
        ZStack {
            if let uiImage = image {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                Circle().fill(Color.blue.opacity(0.1))
                Text(String(company.prefix(2).uppercased()))
                    .couponFont(size / 3, weight: .bold)
                    .foregroundColor(.blue)
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
            ZStack {
                RoundedRectangle(cornerRadius: size / 4)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color(red: 0.2, green: 0.6, blue: 1.0),
                                Color(red: 0.1, green: 0.5, blue: 0.9)
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: size, height: size)

                VStack(spacing: 1) {
                    Text("%")
                        .couponFont(size / 2, weight: .heavy)
                        .foregroundColor(.white)
                    Text("✂")
                        .font(.system(size: size / 3))
                        .foregroundColor(.white.opacity(0.8))
                }
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
                    logoUrl: coupon.logoUrl,
                    size: compact ? 40 : 48
                )

                VStack(alignment: .leading, spacing: compact ? 3 : 4) {
                    Text(coupon.company)
                        .couponFont(compact ? 13 : 15, weight: .semibold)
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Text("יתרה: \(Int(coupon.remainingValue))₪")
                        .couponFont(compact ? 10 : 12, weight: .semibold)
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(formatCouponCode(coupon.code))
                    .couponFont(compact ? 9 : 10, weight: .bold)
                    .foregroundColor(.blue)
                    .lineLimit(4)
                    .minimumScaleFactor(0.6)
                    .multilineTextAlignment(.center)
                    .lineSpacing(1)
                    .padding(.horizontal, compact ? 8 : 10)
                    .padding(.vertical, compact ? 12 : 8)
                    .background(
                        RoundedRectangle(cornerRadius: 15)
                            .fill(Color.blue.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 15)
                                    .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                            )
                    )

                Image(systemName: layoutDirection == .rightToLeft ? "chevron.right" : "chevron.left")
                    .couponFont(12, weight: .bold)
                    .foregroundColor(.gray)
                    .opacity(0.5)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.primary.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.primary.opacity(0.08), lineWidth: 1)
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
            WidgetStyle.primaryGradient.edgesIgnoringSafeArea(.all)

            VStack(spacing: 0) {
                Spacer()
                Spacer()

                VStack(spacing: 10) {
                    AppLogoView(size: 24)
                    Rectangle()
                        .fill(Color.white.opacity(0.2))
                        .frame(height: 1)
                        .padding(.horizontal, 20)
                }

                HStack {
                    statColumn(label: "חד פעמיים", value: payload.oneTimeCouponsCount)
                    Spacer()
                    statColumn(label: "קופונים פעילים", value: payload.activeCouponsCount)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)

                Spacer()

                VStack(spacing: 6) {
                    Text("₪\(Int(payload.totalRemainingValue))")
                        .couponFont(34, weight: .bold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    Text("נותר לשימוש")
                        .couponFont(13)
                        .foregroundColor(.white.opacity(0.7))
                }

                Spacer()
                Spacer()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func statColumn(label: String, value: Int) -> some View {
        VStack(alignment: .center, spacing: 2) {
            Text(label)
                .couponFont(9)
                .foregroundColor(.white.opacity(0.8))
            Text("\(value)")
                .couponFont(20, weight: .bold)
                .foregroundColor(.white)
        }
    }

    private var expiringView: some View {
        ZStack {
            WidgetStyle.alertGradient.edgesIgnoringSafeArea(.all)

            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .couponFont(16, weight: .bold)
                        .foregroundColor(.white)
                    Text("קופון עומד לפוג תוקף!")
                        .couponFont(12, weight: .bold)
                        .foregroundColor(.white)
                }

                if let first = expiringThisWeek.first {
                    VStack(spacing: 4) {
                        Text(first.company)
                            .couponFont(16, weight: .semibold)
                            .foregroundColor(.white)

                        Text("₪\(Int(first.remainingValue))")
                            .couponFont(24, weight: .bold)
                            .foregroundColor(.white)

                        if let date = first.expirationDate {
                            let daysLeft = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
                            Text("נותרו \(daysLeft) ימים")
                                .couponFont(11, weight: .medium)
                                .foregroundColor(.white.opacity(0.9))
                        }
                    }
                }

                Text("מתחלף לסטטיסטיקות...")
                    .couponFont(8)
                    .foregroundColor(.white.opacity(0.6))
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
            WidgetStyle.primaryGradient.edgesIgnoringSafeArea(.all)

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
                            .fill(Color.primary.opacity(0.05))
                            .overlay(
                                Text("בחר קופון נוסף")
                                    .couponFont(12)
                                    .foregroundColor(.white.opacity(0.6))
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
            WidgetStyle.primaryGradient.edgesIgnoringSafeArea(.all)

            VStack(spacing: 4) {
                HStack(spacing: 12) {
                    AppLogoView(size: 32)

                    VStack(alignment: .center, spacing: 2) {
                        Text("קופונים פעילים: \(payload.activeCouponsCount)")
                            .couponFont(14, weight: .semibold)
                            .foregroundColor(.white)

                        Text("יתרה: ₪\(Int(payload.totalRemainingValue))")
                            .couponFont(14, weight: .medium)
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)

                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)

                Rectangle()
                    .fill(Color.primary.opacity(0.08))
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
    .foregroundColor(.white.opacity(0.6))
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
