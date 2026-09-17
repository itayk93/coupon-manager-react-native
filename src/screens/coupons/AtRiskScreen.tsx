import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "@/components/ui/Header";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble } from "@/components/ui/SpeechBubble";
import { KuponiStory } from "@/components/ui/KuponiStory";
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
 * makes the rest of the page worth reading, and he says it rather than
 * captioning it: the talking loop runs for exactly as long as the line takes
 * to arrive, then he drops back to the face the deadline gives him. That is
 * `docs/mascot/STATE-LAW.md`'s "one reaction on entry" for `talking`, and the
 * resting state is still derived from `expiryLevel` and nothing else.
 *
 * The bubble is *above* him, with the tail pointing down at his head. That is
 * the comic-book arrangement and it is not decoration: a balloon under a
 * character with a tail pointing up at their feet is the shape of a caption
 * under a photograph, and it reads as one no matter what the character is
 * doing. The lettering rule is that the tail should point at the speaker's
 * mouth and close most of the distance to it, which is what `lift` below is
 * for — one per piece of artwork, since the two sprites this screen alternates
 * between are framed differently.
 *
 * After the line is out he plays `priority-pick`: ten seconds of him weighing
 * the coupons and settling on one, from `assets/mascot/stories/`. It runs once
 * per most-urgent coupon and only in the 2–14 day window; today and tomorrow
 * keep the `alarmed` loop, which is the right register for money that goes
 * tonight.
 *
 * Under him is the coupon itself — `CouponCard`, the card from the coupons
 * list — because every route out of this screen is on it: the code to hand the
 * cashier, and the usage report that takes the coupon off this page for good.
 */

/** What `size="large"` resolves to in `Kuponi`, named because the lift needs it. */
const MASCOT_SIZE = 176;

/**
 * The transparent headroom each sprite carries above his head, as a fraction of
 * its box — and it is not one number, because this screen shows two different
 * pieces of artwork.
 *
 * `legacy` is the 36-frame urgency atlas: 40–43px above the head in a 256px
 * cell, a 1.2-point spread, which is why a single constant ever worked.
 * `story` is `priority-pick`: 52–57px in a 256px cell after the
 * full-resolution rebuild. Its midpoint still rounds to the same 37pt lift.
 *
 * The camera framing is deliberate in both — it is cut for a character who
 * bobs — but laid out naively that space becomes 28 or 37pt of nothing between
 * the bubble's tail and the head it is pointing at, and a tail that stops short
 * of its speaker is what makes a balloon read as floating text.
 *
 * The two differ by nine points, so a lift calibrated for one drops the other.
 * Deriving the lift per sprite is also what makes the swap invisible: both
 * land the *head* in the same place, so only the box moves.
 */
const HEADROOM = { legacy: 0.16, story: 0.2125 };

/** How much clear air to leave between the bubble's edge and the top of his
 *  head. The tail is 11pt on the diagonal and hangs about 6 of them below the
 *  bubble, so at this gap it closes a little over half the distance — which is
 *  the lettering convention for where a tail should end. */
const HEAD_GAP = 10;

/** Pulling him up by his own headroom is what puts the tail on his head. */
const lift = (headroom: number) => HEAD_GAP - Math.round(MASCOT_SIZE * headroom);

/**
 * The window `priority-pick` is for. Today and tomorrow keep `alarmed`: a
 * ten-second story about weighing your options is the wrong register for money
 * that disappears tonight, and `STATE-LAW.md`'s escalation already owns that
 * rung.
 */
const STORY_MIN_DAYS = 2;
const STORY_MAX_DAYS = 14;

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
  // nearest expiry was nine days away got "₪55 on the line across 2 coupons"
  // above an empty page.
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

  const line =
    atRisk.length === 1
      ? `${formatIls(totalAtRisk)} על הכף בקופון אחד`
      : `${formatIls(totalAtRisk)} על הכף ב-${atRisk.length} קופונים`;
  // He is talking until he has finished saying *this* line, so a refresh that
  // changes the number is said again rather than appearing behind his back.
  const [spokenLine, setSpokenLine] = useState<string | null>(null);
  const speaking = spokenLine !== line;

  /**
   * `priority-pick` — him weighing the coupons and settling on one — plays once
   * per most-urgent coupon, *after* the bubble has finished its line.
   *
   * The two are deliberately sequential rather than simultaneous. Both own the
   * character for a stretch of time, and two timers racing for one `state` is
   * how a mascot ends up twitching between poses. The bubble's `onSpoken` is
   * also not a stand-in for the story being over — it says the sentence
   * arrived, nothing more — so the story keeps its own completion.
   */
  const urgent = atRisk[0];
  const storyKey = urgent ? `${urgent.coupon.id}:${urgent.days}` : null;
  const [storyPlayed, setStoryPlayed] = useState<string | null>(null);
  const [storyBroken, setStoryBroken] = useState(false);
  const showStory =
    !speaking &&
    !storyBroken &&
    storyKey !== null &&
    storyPlayed !== storyKey &&
    worst !== null &&
    worst >= STORY_MIN_DAYS &&
    worst <= STORY_MAX_DAYS;

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
            {/* One sprite at a time, never both: each atlas is tens of
                megabytes once decoded, and `enabled` pauses a player without
                unmounting it. Swapping the component is what actually gives
                the memory back. The lift travels with the artwork, so his head
                stays under the tail across the swap and only the box moves. */}
            <View style={{ marginTop: lift(showStory ? HEADROOM.story : HEADROOM.legacy) }}>
              {showStory ? (
                <KuponiStory
                  story="priority-pick"
                  replayKey={storyKey}
                  size={MASCOT_SIZE}
                  // The usage modal covers him; a story playing to nobody
                  // behind it burns the one showing it is allowed.
                  enabled={usageCoupon === null}
                  onFinish={() => setStoryPlayed(storyKey)}
                  onError={() => setStoryBroken(true)}
                  accessibilityLabel="קופוני בוחן איזה קופון כדאי לנצל קודם"
                />
              ) : (
                <Kuponi
                  state={speaking ? "talking" : kuponi.state}
                  speed={kuponi.speed}
                  size={MASCOT_SIZE}
                />
              )}
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
  // bubble and the character is the sprite's own lift, which has to be able to
  // go negative to cancel its headroom.
  hero: { alignItems: "center", marginBottom: 20 },
  bubble: { maxWidth: 300 },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 8,
  },
});
