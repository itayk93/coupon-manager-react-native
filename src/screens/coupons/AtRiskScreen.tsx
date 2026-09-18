import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "@/components/ui/Header";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble, SPEECH_TAIL_CLEARANCE, SPEECH_TAIL_DROP } from "@/components/ui/SpeechBubble";
import { EmptyState } from "@/components/ui/EmptyState";
import { KuponiLoading } from "@/components/ui/KuponiLoading";
import { CouponCard } from "@/components/coupons/CouponCard";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { useCoupons, type DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponTagsMap } from "@/hooks/useTags";
import { useAppTheme } from "@/contexts/ThemeContext";
import { expiringSoon } from "@/lib/homeHero";
import { EXPIRY_PERFORMANCE, expiryLevel, type ExpiryLevel } from "@/lib/expiryUrgency";
import { couponRemainingValue } from "@/lib/couponTotals";
import { couponRouteId } from "@/lib/couponId";
import { formatIls } from "@/lib/formatIls";
import { fonts } from "@/lib/theme";

/**
 * Everything about to expire, most urgent first, and what it is worth.
 *
 * This is the screen the whole character exists for. The product's real
 * failure mode is a silent one — a coupon expires and the money is simply
 * gone, with nothing to react to — and until now the app's answer was a
 * banner that linked to one coupon. `expiringSoon` has always returned the
 * whole list, sorted by days and then by how much is left on each, because a
 * coupon worth ₪200 expiring on the same day as one worth ₪20 is the one to
 * open first.
 *
 * Kuponi says how much is about to expire and nothing else. It is the one
 * number that makes the rest of the page worth reading, and he says it rather
 * than captioning it: the talking loop runs for exactly as long as the line
 * takes to arrive, then he drops back to the face the deadline gives him. That
 * is `docs/mascot/STATE-LAW.md`'s "one reaction on entry" for `talking`, and
 * the resting state is still derived from `expiryLevel` and nothing else.
 *
 * One piece of artwork, start to finish. He used to hand over to `priority-pick`
 * — ten seconds of him weighing the coupons — once the line was out, which
 * meant the screen swapped sprites in front of the user: two atlases, two box
 * sizes, two framings of the same character, and a cut between them that no
 * amount of matching the head position hides, because the drawing itself
 * changes. Two animations in one hero is one more than the hero is saying. The
 * story player is still there for a screen that wants a story of its own; this
 * one wants him to say his line and hold the expression the date earns.
 *
 * The balloon is *above* him, with the tail pointing down at his head. That is
 * the comic-book arrangement and it is not decoration: a balloon under a
 * character with a tail pointing up at their feet is the shape of a caption
 * under a photograph, and it reads as one no matter what the character is
 * doing. The lettering rule is that the tail should point at the speaker's
 * mouth and close most of the distance to it, which is what `HEAD_GAP` and
 * `LIFT` below are for.
 *
 * Under him is the coupon itself — `CouponCard`, the card from the coupons
 * list — because every route out of this screen is on it: the code to hand the
 * cashier, and the usage report that takes the coupon off this page for good.
 */

/**
 * The artwork he is drawn from: the 36-frame urgency atlas, a 256px cell
 * carrying 40–43px of transparent space above his head, drawn here at 176pt.
 *
 * The headroom is the minimum across every frame, measured off the shipped
 * atlas rather than taken from a spec, and it describes this atlas only.
 */
const SPRITE = { size: 176, headroom: 0.16 };

/**
 * How much clear air to leave between the balloon's edge and the top of his
 * head: the balloon's own clearance, since what the tail is reaching for here
 * is the top of his head rather than the bottom of a box. The spike closes
 * `SPEECH_TAIL_DROP` of it and stops, a little short of him.
 */
const HEAD_GAP = SPEECH_TAIL_CLEARANCE;

/** Pulling him up by his own headroom is what puts the tail on his head. */
const LIFT = HEAD_GAP - Math.round(SPRITE.size * SPRITE.headroom);

const SECTIONS: { level: ExpiryLevel; title: string }[] = [
  { level: "alarm", title: "היום ומחר" },
  { level: "worry", title: "בימים הקרובים" },
  { level: "watch", title: "בשבוע הקרוב" },
  // The page's window and the face's escalation do not end in the same place:
  // `expiringSoon` reaches `HOME_HERO_WINDOW_DAYS` (14) while `expiryLevel`
  // tops out at `WATCH_MAX_DAYS` (7) and calls everything past it `none`. That
  // is right for the face — a coupon eleven days out has not earned a worried
  // one — but those coupons are still money with a date on it, and they were
  // being counted in Kuponi's total and then listed nowhere. A wallet whose
  // nearest expiry was nine days away got "₪55 about to expire across 2
  // coupons" above an empty page.
  { level: "none", title: "בשבועיים הקרובים" },
];

export function AtRiskScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading } = useCoupons();
  const { data: tagsMap = {} } = useCouponTagsMap();
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);

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

  // What is happening, in the words it happens in. "Money on the line" is a
  // gambling figure — it is what you stand to lose on a bet you chose to make
  // — and nobody chose this. The coupons are expiring; that is the whole fact,
  // and `VOICE.md`'s tone table already says it that way ("יש ₪340 שפגים מחר").
  const line =
    atRisk.length === 1
      ? `${formatIls(totalAtRisk)} עומדים לפוג בקופון אחד`
      : `${formatIls(totalAtRisk)} עומדים לפוג ב-${atRisk.length} קופונים`;
  // He is talking until he has finished saying *this* line, so a refresh that
  // changes the number is said again rather than appearing behind his back.
  const [spokenLine, setSpokenLine] = useState<string | null>(null);
  const speaking = spokenLine !== line;

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
            <SpeechBubble
              tail="down"
              isHeading
              speak
              onSpoken={() => setSpokenLine(line)}
              text={line}
              style={styles.bubble}
            />
            <View style={styles.mascot}>
              <Kuponi
                state={speaking ? "talking" : kuponi.state}
                speed={kuponi.speed}
                size={SPRITE.size}
              />
            </View>
          </View>

          {grouped.map((section) => (
            <View key={section.level}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{section.title}</Text>
              {section.entries.map(({ coupon }) => (
                <CouponCard
                  key={coupon.id}
                  coupon={coupon}
                  tags={tagsMap[coupon.id] || []}
                  onPress={() => router.push(`/coupons/${couponRouteId(coupon)}`)}
                  onReportUsage={() => setUsageCoupon(coupon)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <QuickUsageModal
        visible={usageCoupon !== null}
        onClose={() => setUsageCoupon(null)}
        coupons={coupons}
        preselectedCoupon={usageCoupon}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  // `CouponCard` carries its own bottom margin, so the page spaces itself and
  // only the hero needs a gap of its own. No `gap` here: the space between the
  // balloon and the character is the sprite's own lift, which has to be able to
  // go negative to cancel its headroom.
  hero: { alignItems: "center", marginBottom: 20 },
  mascot: { marginTop: LIFT },
  bubble: { maxWidth: 300 },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 8,
  },
});
