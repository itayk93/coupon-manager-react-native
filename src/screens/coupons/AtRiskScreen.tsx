import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble } from "@/components/ui/SpeechBubble";
import { EmptyState } from "@/components/ui/EmptyState";
import { KuponiLoading } from "@/components/ui/KuponiLoading";
import { ShimmerLogo } from "@/components/coupons/ShimmerLogo";
import { useCoupons } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { expiringSoon } from "@/lib/homeHero";
import { EXPIRY_PERFORMANCE, daysPhrase, expiryLevel, type ExpiryLevel } from "@/lib/expiryUrgency";
import { couponRemainingValue } from "@/lib/couponTotals";
import { couponRouteId } from "@/lib/couponId";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { formatIls } from "@/lib/formatIls";
import { fonts, radii } from "@/lib/theme";

/**
 * Everything about to expire, most urgent first, with the money on the line.
 *
 * This is the screen the whole character exists for. The product's real
 * failure mode is a silent one — a coupon expires and the money is simply
 * gone, with nothing to react to — and until now the app's answer was a
 * banner that linked to one coupon. `expiringSoon` has always returned the
 * whole list, sorted by days and then by how much is left on each, because a
 * coupon worth ₪200 expiring on the same day as one worth ₪20 is the one to
 * open first.
 *
 * Kuponi says the total at risk and nothing else. It is the one number that
 * makes the rest of the page worth reading.
 */

const SECTIONS: { level: Exclude<ExpiryLevel, "none">; title: string }[] = [
  { level: "alarm", title: "היום ומחר" },
  { level: "worry", title: "בימים הקרובים" },
  { level: "watch", title: "בשבוע הקרוב" },
];

export function AtRiskScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading } = useCoupons();

  const atRisk = useMemo(() => expiringSoon(coupons), [coupons]);
  const totalAtRisk = useMemo(
    () => atRisk.reduce((sum, entry) => sum + couponRemainingValue(entry.coupon), 0),
    [atRisk]
  );
  const grouped = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        entries: atRisk.filter((entry) => expiryLevel(entry.days) === section.level),
      })).filter((section) => section.entries.length > 0),
    [atRisk]
  );

  // The loudest coupon on the page sets how hard he plays it.
  const worst = atRisk[0]?.days ?? null;
  const kuponi = EXPIRY_PERFORMANCE[expiryLevel(worst)];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <Header title="מה בסכנה" showBack onBack={() => router.back()} />
      {isLoading ? (
        <KuponiLoading title="בודק מה עומד לפוג" subtitle="עובר על התאריכים בארנק" />
      ) : atRisk.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            title="שום דבר לא בסכנה כרגע"
            subtitle="אין קופון שפג בשבועיים הקרובים. אחזור להציק כשיהיה."
            largeVisual
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Kuponi state={kuponi.state} speed={kuponi.speed} size="large" />
            <SpeechBubble
              tail="up"
              isHeading
              text={
                atRisk.length === 1
                  ? `${formatIls(totalAtRisk)} על הכף בקופון אחד`
                  : `${formatIls(totalAtRisk)} על הכף ב-${atRisk.length} קופונים`
              }
              style={styles.bubble}
            />
          </View>

          {grouped.map((section) => (
            <View key={section.level} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{section.title}</Text>
              {section.entries.map(({ coupon, days }) => (
                <TouchableOpacity
                  key={coupon.id}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/coupons/${couponRouteId(coupon)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${coupon.company}, ${daysPhrase(days)}, נשארו ${formatIls(couponRemainingValue(coupon))}`}
                  style={[styles.row, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <ShimmerLogo source={getCompanyLogoSource(coupon.company)} size={40} style={styles.logo} />
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.company, { color: theme.text }]}>
                      {coupon.company}
                    </Text>
                    <Text style={[styles.deadline, { color: days <= 1 ? theme.dangerText : theme.textMuted }]}>
                      {daysPhrase(days)}
                    </Text>
                  </View>
                  <Text style={[styles.amount, { color: theme.text }]}>
                    {formatIls(couponRemainingValue(coupon))}
                  </Text>
                  <ChevronLeft size={18} color={theme.textSubtle} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 18 },
  hero: { alignItems: "center", gap: 10 },
  bubble: { maxWidth: 300 },
  section: { gap: 8 },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  logo: { borderRadius: 10 },
  rowCopy: { flex: 1, alignItems: "flex-end" },
  company: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  deadline: { fontFamily: fonts.body, fontSize: 13, textAlign: "right", writingDirection: "rtl", marginTop: 2 },
  amount: { fontFamily: fonts.display, fontSize: 16, fontWeight: "800", writingDirection: "ltr" },
});
