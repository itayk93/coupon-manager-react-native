import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble, SPEECH_TAIL_CLEARANCE } from "@/components/ui/SpeechBubble";
import { KuponiLoading } from "@/components/ui/KuponiLoading";
import { IlsAmount } from "@/components/ui/IlsAmount";
import { useCoupons } from "@/hooks/useCoupons";
import { useSavingsByMonth } from "@/hooks/useCouponUsage";
import { useAppTheme } from "@/contexts/ThemeContext";
import { monthlyRecap } from "@/lib/monthlyRecap";
import { formatIls } from "@/lib/formatIls";
import { fonts, radii } from "@/lib/theme";

/**
 * The month, in Kuponi's words.
 *
 * The "החודש שלך במספרים" notification has always pointed at the statistics
 * screen, which is a KPI grid covering all time — a fine screen, and not what
 * the notification is about. This is the page that sentence deserved.
 *
 * Two numbers, and the second one is the point: what the month saved, and
 * what it let go. A recap that only counts savings is a scoreboard; the thing
 * this product protects against is money quietly reaching its date.
 */
export function MonthlyRecapScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading } = useCoupons();
  const { data: savingsMonths = {}, isLoading: savingsLoading } = useSavingsByMonth(coupons);

  const recap = useMemo(() => monthlyRecap(coupons, savingsMonths), [coupons, savingsMonths]);

  const line = recap.clean
    ? recap.saved > 0
      ? "חודש נקי. שום דבר לא פג בלי שנוצל."
      : "החודש עוד לא התחיל להיספר, ושום דבר לא פג."
    : recap.lostCount === 1
      ? "קופון אחד פג החודש עם יתרה עליו."
      : `${recap.lostCount} קופונים פגו החודש עם יתרה עליהם.`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <Header title="החודש שלי" showBack onBack={() => router.back()} />
      {isLoading || savingsLoading ? (
        <KuponiLoading title="מסכם לך את החודש" subtitle="עובר על מה שנוצל ומה שפג" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Kuponi state={recap.clean ? "cheering" : "concerned"} size="large" />
            <SpeechBubble tail="up" isHeading text={line} style={styles.bubble} />
          </View>

          <View style={[styles.figure, { backgroundColor: theme.successBg, borderColor: theme.successBg }]}>
            <Text style={[styles.figureLabel, { color: theme.successText }]}>חסכת ב{recap.label}</Text>
            <IlsAmount
              value={Math.round(recap.saved)}
              animate
              countFromZero
              style={[styles.figureValue, { color: theme.successText }]}
              currencyStyle={styles.figureCurrency}
            />
            <Text style={[styles.figureFoot, { color: theme.successText }]}>
              {recap.previousSaved === 0 && recap.saved === 0
                ? "אין עדיין מה להשוות לחודש שעבר"
                : recap.delta > 0
                  ? `${formatIls(Math.round(recap.delta))} יותר מהחודש שעבר`
                  : recap.delta < 0
                    ? `${formatIls(Math.round(-recap.delta))} פחות מהחודש שעבר`
                    : "בדיוק כמו החודש שעבר"}
            </Text>
          </View>

          {recap.clean ? (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>אפס בזבוז</Text>
              <Text style={[styles.cardText, { color: theme.textMuted }]}>
                אף קופון לא הגיע לתאריך שלו עם כסף עליו. זה בדיוק מה שאני שומר עליו.
              </Text>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.dangerText }]}>
                {formatIls(Math.round(recap.lostValue))} פגו בלי שנוצלו
              </Text>
              <Text style={[styles.cardText, { color: theme.dangerText }]}>
                אין מה לעשות עם אלה עכשיו. אפשר לוודא שזה לא יקרה שוב לקופונים שעוד בארנק.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/at-risk")}
                accessibilityRole="button"
                style={styles.cardLink}
              >
                <ChevronLeft size={15} color={theme.dangerText} />
                <Text style={[styles.cardLinkText, { color: theme.dangerText }]}>מה בסכנה עכשיו</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/milestones")}
            accessibilityRole="button"
            style={[styles.card, styles.cardRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <ChevronLeft size={16} color={theme.textSubtle} />
            <Text style={[styles.cardTitle, styles.cardRowTitle, { color: theme.text }]}>אבני הדרך שלי</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  hero: { alignItems: "center", gap: SPEECH_TAIL_CLEARANCE },
  bubble: { maxWidth: 300 },
  figure: { alignItems: "center", gap: 2, paddingVertical: 20, borderRadius: radii.card, borderWidth: 1 },
  figureLabel: { fontFamily: fonts.bodyBold, fontSize: 14, textAlign: "center", writingDirection: "rtl" },
  figureValue: { fontFamily: fonts.display, fontSize: 42, fontWeight: "800", textAlign: "center" },
  figureCurrency: { fontSize: 24 },
  figureFoot: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", writingDirection: "rtl", marginTop: 4 },
  card: { borderWidth: 1, borderRadius: radii.card, padding: 14, gap: 6 },
  cardRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cardRowTitle: { flex: 1 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  cardText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" },
  cardLink: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingTop: 4 },
  cardLinkText: { fontFamily: fonts.bodyBold, fontSize: 13, writingDirection: "rtl" },
});
