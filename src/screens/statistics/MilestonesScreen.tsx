import React from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble } from "@/components/ui/SpeechBubble";
import { EmptyState } from "@/components/ui/EmptyState";
import { KuponiLoading } from "@/components/ui/KuponiLoading";
import { useMilestones } from "@/hooks/useMilestones";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { Ladder, MilestoneSummary } from "@/lib/milestones";
import { formatIls } from "@/lib/formatIls";
import { fonts, radii } from "@/lib/theme";

/**
 * Every milestone the wallet has passed, kept instead of thrown away.
 *
 * Ten celebration scenes were produced and each one showed for a day and was
 * gone forever. The tokens were being stored the whole time — this is the page
 * that reads them back.
 *
 * It counts shekels and coupons, never sessions. There is no streak here and
 * no reward for opening the app, because opening the app is not the point;
 * see `docs/mascot/README.md`, "מה זה לא".
 */

const SCENES = {
  anniversary: require("../../../assets/mascot/celebration/app/C1-anniversary.webp"),
  record: require("../../../assets/mascot/celebration/app/C9-wallet-record.webp"),
  "six-seven": require("../../../assets/mascot/celebration/app/C2-coupon-milestone.webp"),
  clean: require("../../../assets/mascot/celebration/app/C7-clean-month.webp"),
  monthly: require("../../../assets/mascot/celebration/app/C4-monthly-recap.webp"),
} as const;

const LADDER_TITLE: Record<Ladder["kind"], string> = {
  milestone: "קופונים בארנק",
  savings: "חיסכון מצטבר",
};

const oneOffLabel = (kind: MilestoneSummary["oneOffs"][number]["kind"], value: number) =>
  kind === "anniversary"
    ? value === 1
      ? "שנה ביחד"
      : `${value} שנים ביחד`
    : kind === "record"
      ? `שיא ארנק: ${formatIls(value)}`
      : "67 קופונים";

const repeatLabel = (kind: MilestoneSummary["repeats"][number]["kind"], count: number) =>
  kind === "clean"
    ? count === 1
      ? "חודש אחד בלי שקל שפג"
      : `${count} חודשים בלי שקל שפג`
    : count === 1
      ? "סיכום חודשי אחד"
      : `${count} סיכומים חודשיים`;

export function MilestonesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data, isLoading } = useMilestones();

  const stepText = (kind: Ladder["kind"], value: number) =>
    kind === "savings" ? formatIls(value) : String(value);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <Header title="אבני הדרך שלי" showBack onBack={() => router.back()} />
      {isLoading || !data ? (
        <KuponiLoading title="אוסף את אבני הדרך" subtitle="עובר על מה שכבר עברת" />
      ) : data.total === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            largeVisual
            title="עוד לא עברנו אבן דרך"
            subtitle="חמישה קופונים בארנק, או ₪1,000 חיסכון מצטבר — מה שיגיע קודם. אני סופר."
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Kuponi state="cheering" size="large" />
            <SpeechBubble
              tail="up"
              isHeading
              text={data.total === 1 ? "אבן דרך אחת עד היום" : `${data.total} אבני דרך עד היום`}
              style={styles.bubble}
            />
          </View>

          {data.ladders.map((rung) => (
            <View key={rung.kind} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{LADDER_TITLE[rung.kind]}</Text>
              <View style={styles.rungs}>
                {rung.steps.map((step) => (
                  <View
                    key={step.value}
                    style={[
                      styles.rung,
                      step.reached
                        ? { backgroundColor: theme.successBg, borderColor: theme.successBg }
                        : { borderColor: theme.cardBorder },
                    ]}
                  >
                    {step.reached ? <Check size={12} color={theme.successText} /> : null}
                    <Text
                      style={[
                        styles.rungText,
                        { color: step.reached ? theme.successText : theme.textSubtle },
                      ]}
                    >
                      {stepText(rung.kind, step.value)}
                    </Text>
                  </View>
                ))}
              </View>
              {rung.next !== null ? (
                <Text style={[styles.nextUp, { color: theme.textMuted }]}>
                  הבא בתור: {stepText(rung.kind, rung.next)}
                </Text>
              ) : (
                <Text style={[styles.nextUp, { color: theme.successText }]}>עברת את כל הסולם.</Text>
              )}
            </View>
          ))}

          {data.oneOffs.length || data.repeats.length ? (
            <View style={styles.moments}>
              {data.oneOffs.map((moment) => (
                <Moment
                  key={moment.kind}
                  source={SCENES[moment.kind]}
                  label={oneOffLabel(moment.kind, moment.value)}
                />
              ))}
              {data.repeats.map((moment) => (
                <Moment
                  key={moment.kind}
                  source={SCENES[moment.kind]}
                  label={repeatLabel(moment.kind, moment.count)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Moment({ source, label }: { source: number; label: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.moment, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <Image source={source} style={styles.momentScene} accessible={false} resizeMode="cover" />
      <Text style={[styles.momentLabel, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  hero: { alignItems: "center", gap: 10 },
  bubble: { maxWidth: 300 },
  card: { borderWidth: 1, borderRadius: radii.card, padding: 14, gap: 10 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  rungs: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  rung: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  rungText: { fontFamily: fonts.bodyBold, fontSize: 13, writingDirection: "ltr" },
  nextUp: { fontFamily: fonts.body, fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  moments: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  moment: { width: 150, borderWidth: 1, borderRadius: radii.card, overflow: "hidden" },
  momentScene: { width: "100%", height: 110 },
  momentLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    padding: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
