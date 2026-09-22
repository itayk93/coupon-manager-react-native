import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Check, Lock, Sparkles, Ticket } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Kuponi } from "@/components/ui/Kuponi";
import { Modal } from "@/components/ui/Modal";
import { PressableScale } from "@/components/ui/PressableScale";
import { SpeechBubble, SPEECH_TAIL_CLEARANCE } from "@/components/ui/SpeechBubble";
import { EmptyState } from "@/components/ui/EmptyState";
import { KuponiLoading } from "@/components/ui/KuponiLoading";
import { useMilestones } from "@/hooks/useMilestones";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { Ladder, LadderStep, MilestoneSummary } from "@/lib/milestones";
import { formatIlsCompact } from "@/lib/formatIls";
import { fonts, radii } from "@/lib/theme";

/**
 * Every milestone the wallet has passed, and the one it is walking towards.
 *
 * The first version was a list of what had already happened: two rows of pills
 * with ticks on the ones behind you. True, and inert — it never said where the
 * wallet actually stands, so the next rung was a number with no distance
 * attached, and nothing on the page could be touched.
 *
 * So the page is built around the walk instead. The trail runs top to bottom in
 * the order the steps come; the rail behind it is drawn in brand blue as far as
 * the wallet has come and grey from there on, which is the whole story in one
 * glance. The step being walked towards carries the only progress bar on the
 * page, because it is the only one a person can do anything about. Every stone
 * opens.
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

/** The art each ladder celebrates with, for the stone that opens. */
const LADDER_SCENE: Record<Ladder["kind"], number> = {
  milestone: require("../../../assets/mascot/celebration/app/C2-coupon-milestone.webp"),
  savings: require("../../../assets/mascot/celebration/app/C3-lifetime-savings.webp"),
};

const LADDER_TITLE: Record<Ladder["kind"], string> = {
  milestone: "קופונים בארנק",
  savings: "חיסכון מצטבר",
};

/** Whole coupons or rounded shekels — a milestone never has agorot. */
const stepText = (kind: Ladder["kind"], value: number) =>
  kind === "savings" ? formatIlsCompact(value) : String(Math.round(value));

const remainingText = (kind: Ladder["kind"], gap: number) =>
  kind === "savings"
    ? `עוד ${formatIlsCompact(gap)}`
    : gap === 1
      ? "עוד קופון אחד"
      : `עוד ${Math.ceil(gap)} קופונים`;

const oneOffLabel = (kind: MilestoneSummary["oneOffs"][number]["kind"], value: number) =>
  kind === "anniversary"
    ? value === 1
      ? "שנה ביחד"
      : `${value} שנים ביחד`
    : kind === "record"
      ? `שיא ארנק: ${formatIlsCompact(value)}`
      : "67 קופונים";

const repeatLabel = (kind: MilestoneSummary["repeats"][number]["kind"], count: number) =>
  kind === "clean"
    ? count === 1
      ? "חודש אחד בלי שקל שפג"
      : `${count} חודשים בלי שקל שפג`
    : count === 1
      ? "סיכום חודשי אחד"
      : `${count} סיכומים חודשיים`;

/** How far along the leg between the last step passed and the next one. */
function legProgress(rung: Ladder): number {
  if (rung.next === null) return 1;
  const from = rung.best ?? 0;
  const span = rung.next - from;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (rung.value - from) / span));
}

export function MilestonesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { data, isLoading } = useMilestones();
  const [openStone, setOpenStone] = useState<{ rung: Ladder; step: LadderStep } | null>(null);

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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero summary={data} />
          {data.ladders.map((rung) => (
            <Trail key={rung.kind} rung={rung} onOpen={(step) => setOpenStone({ rung, step })} />
          ))}

          {data.oneOffs.length || data.repeats.length ? (
            <View style={styles.momentsBlock}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>רגעים</Text>
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
            </View>
          ) : null}
        </ScrollView>
      )}

      <StoneSheet stone={openStone} onClose={() => setOpenStone(null)} />
    </SafeAreaView>
  );
}

/** The count, and the two figures it was counted from. */
function Hero({ summary }: { summary: MilestoneSummary }) {
  const { theme } = useAppTheme();
  const [coupons, savings] = summary.ladders;

  return (
    <View style={[styles.hero, { backgroundColor: theme.primaryTint, borderColor: theme.cardBorder }]}>
      <Kuponi state="cheering" size="large" />
      <SpeechBubble
        tail="up"
        isHeading
        text={summary.total === 1 ? "אבן דרך אחת עד היום" : `${summary.total} אבני דרך עד היום`}
        style={styles.bubble}
      />
      {/* Where the two numbers stand right now. The ladders below are the
          history; these are the figures they were counted from. */}
      <View style={styles.standingRow}>
        <Standing
          icon={<Ticket size={15} color={theme.primary} />}
          value={String(Math.round(coupons.value))}
          label="קופונים בארנק"
        />
        <Standing
          icon={<Sparkles size={15} color={theme.success} />}
          value={formatIlsCompact(savings.value)}
          label="נחסך עד היום"
        />
      </View>
    </View>
  );
}

function Standing({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.standing, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={styles.standingHead}>
        {icon}
        <Text style={[styles.standingValue, { color: theme.text }]}>{value}</Text>
      </View>
      <Text style={[styles.standingLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

/**
 * One ladder as a trail: a rail down the starting edge, a stone per step, and
 * the rail coloured as far as the wallet has walked.
 */
function Trail({ rung, onOpen }: { rung: Ladder; onOpen: (step: LadderStep) => void }) {
  const { theme } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const passed = rung.steps.filter((step) => step.reached).length;
  const leg = legProgress(rung);

  // The rail is drawn between the stones' own centres rather than down the
  // whole card: the step being walked towards is a taller row than the rest,
  // so anything estimated from the step count ends up pointing between two
  // stones instead of at one.
  const [centres, setCentres] = useState<number[]>([]);
  const measure = (index: number, top: number, height: number) =>
    setCentres((current) => {
      const next = [...current];
      next[index] = top + height / 2;
      if (current[index] === next[index]) return current;
      return next;
    });

  const measured = centres.length === rung.steps.length && centres.every((c) => c !== undefined);
  const from = measured ? centres[0] : 0;
  const to = measured ? centres[centres.length - 1] : 0;
  // As far as the last stone passed, plus the walked part of the leg to the
  // next one — the same fraction the bar on that stone shows.
  const reachedAt = measured ? (passed === 0 ? from : centres[passed - 1]) : 0;
  const nextAt = measured ? (centres[passed] ?? reachedAt) : 0;
  const walked = measured ? Math.max(0, reachedAt - from + (nextAt - reachedAt) * leg) : 0;

  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!measured) return;
    if (reduceMotion) {
      grow.setValue(walked);
      return;
    }
    const run = Animated.timing(grow, {
      toValue: walked,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      // A height in pixels is not a transform, so this one stays on the JS side.
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [grow, measured, reduceMotion, walked]);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{LADDER_TITLE[rung.kind]}</Text>
        <Text style={[styles.cardCount, { color: theme.textSubtle }]}>
          {passed}/{rung.steps.length}
        </Text>
      </View>

      <View style={styles.trail}>
        {measured ? (
          <>
            <View style={[styles.rail, { backgroundColor: theme.track, top: from, height: to - from }]} />
            <Animated.View
              style={[styles.rail, { backgroundColor: theme.primary, top: from, height: grow }]}
            />
          </>
        ) : null}
        {rung.steps.map((step, index) => (
          <View
            key={step.value}
            onLayout={(event) => measure(index, event.nativeEvent.layout.y, event.nativeEvent.layout.height)}
          >
            <Stone
              rung={rung}
              step={step}
              next={rung.next === step.value}
              last={index === rung.steps.length - 1}
              progress={rung.next === step.value ? leg : 0}
              onPress={() => onOpen(step)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** One step on the trail: passed, being walked towards, or still locked. */
function Stone({
  rung,
  step,
  next,
  last,
  progress,
  onPress,
}: {
  rung: Ladder;
  step: LadderStep;
  next: boolean;
  last: boolean;
  progress: number;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const fill = useRef(new Animated.Value(reduceMotion ? progress : 0)).current;

  useEffect(() => {
    if (!next) return;
    if (reduceMotion) {
      fill.setValue(progress);
      return;
    }
    const run = Animated.timing(fill, {
      toValue: progress,
      duration: 900,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [fill, next, progress, reduceMotion]);

  const gap = rung.next === null ? 0 : Math.max(0, rung.next - rung.value);
  const state = step.reached ? "passed" : next ? "next" : "locked";
  const dotStyle =
    state === "passed"
      ? { backgroundColor: theme.primary, borderColor: theme.primary }
      : state === "next"
        ? { backgroundColor: theme.card, borderColor: theme.primary }
        : { backgroundColor: theme.card, borderColor: theme.cardBorder };

  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={`${stepText(rung.kind, step.value)} ${LADDER_TITLE[rung.kind]}. ${
        state === "passed" ? "עברת" : state === "next" ? remainingText(rung.kind, gap) : "נעול"
      }`}
      style={[styles.stone, last && styles.stoneLast]}
    >
      <View style={[styles.dot, dotStyle, state === "next" && { shadowColor: theme.primary }, state === "next" && styles.dotNext]}>
        {state === "passed" ? (
          <Check size={14} color="#ffffff" strokeWidth={3} />
        ) : state === "locked" ? (
          <Lock size={12} color={theme.textSubtle} />
        ) : (
          <View style={[styles.dotCore, { backgroundColor: theme.primary }]} />
        )}
      </View>

      <View
        style={[
          styles.stoneBody,
          state === "next" && styles.stoneBodyNext,
          state === "next" && { backgroundColor: theme.primaryTint },
        ]}
      >
        <View style={styles.stoneHead}>
          <Text
            style={[
              styles.stoneValue,
              { color: state === "locked" ? theme.textSubtle : theme.text },
            ]}
          >
            {stepText(rung.kind, step.value)}
          </Text>
          {state === "next" ? (
            <View style={[styles.chip, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.chipText, { color: theme.primary }]}>הבא בתור</Text>
            </View>
          ) : state === "passed" ? (
            <View style={[styles.chip, { backgroundColor: theme.successBg }]}>
              <Text style={[styles.chipText, { color: theme.successText }]}>עברת</Text>
            </View>
          ) : null}
        </View>

        {/* Only the step being walked towards carries a bar: it is the only
            one the wallet is any distance along. */}
        {state === "next" ? (
          <>
            <View style={[styles.track, { backgroundColor: theme.track }]}>
              <Animated.View
                style={[
                  styles.trackFill,
                  {
                    backgroundColor: theme.primary,
                    width: fill.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.stoneNote, { color: theme.textMuted }]}>
              {remainingText(rung.kind, gap)}
            </Text>
          </>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** What one stone means, in full, when it is tapped. */
function StoneSheet({
  stone,
  onClose,
}: {
  stone: { rung: Ladder; step: LadderStep } | null;
  onClose: () => void;
}) {
  const { theme } = useAppTheme();
  // The sheet keeps drawing its last stone through the exit animation.
  const shown = useRef(stone);
  if (stone) shown.current = stone;
  const current = shown.current;
  if (!current) return <Modal visible={false} onClose={onClose}>{null}</Modal>;

  const { rung, step } = current;
  const gap = Math.max(0, step.value - rung.value);
  const title = `${stepText(rung.kind, step.value)} ${LADDER_TITLE[rung.kind]}`;
  const body = step.reached
    ? rung.kind === "savings"
      ? `עברת את זה. עד היום חסכת ${formatIlsCompact(rung.value)}.`
      : `עברת את זה. בארנק שלך עכשיו ${Math.round(rung.value)} קופונים.`
    : rung.next === step.value
      ? `${remainingText(rung.kind, gap)} ואתה שם.`
      : `עוד לא. ${remainingText(rung.kind, gap)} מהמקום שאתה בו עכשיו.`;

  return (
    <Modal visible={Boolean(stone)} onClose={onClose} title={title}>
      <View style={styles.sheet}>
        <Image
          source={LADDER_SCENE[rung.kind]}
          style={[styles.sheetScene, !step.reached && styles.sheetSceneLocked]}
          accessible={false}
          resizeMode="cover"
        />
        <Text style={[styles.sheetBody, { color: theme.textSecondary }]}>{body}</Text>
      </View>
    </Modal>
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

const DOT = 30;
const RAIL_INSET = DOT / 2 - 1;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },

  hero: {
    alignItems: "center",
    gap: SPEECH_TAIL_CLEARANCE,
    borderWidth: 1,
    borderRadius: radii.hero,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  bubble: { maxWidth: 300 },
  standingRow: { flexDirection: "row-reverse", gap: 10, alignSelf: "stretch", marginTop: 4 },
  standing: { flex: 1, borderWidth: 1, borderRadius: radii.card, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  standingHead: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  standingValue: { fontFamily: fonts.display, fontSize: 19, writingDirection: "ltr" },
  standingLabel: { fontFamily: fonts.body, fontSize: 12, textAlign: "right", writingDirection: "rtl" },

  card: { borderWidth: 1, borderRadius: radii.card, padding: 14, gap: 12 },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  cardCount: { fontFamily: fonts.bodyBold, fontSize: 13, writingDirection: "ltr" },

  trail: { position: "relative" },
  // Right edge: the trail starts where the reading does.
  rail: { position: "absolute", right: RAIL_INSET, width: 2, borderRadius: 1 },

  stone: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12, paddingBottom: 16 },
  stoneLast: { paddingBottom: 0 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotNext: { shadowOpacity: 0.3, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  dotCore: { width: 10, height: 10, borderRadius: 5 },
  stoneBody: { flex: 1, gap: 6, paddingTop: 3 },
  stoneBodyNext: { paddingTop: 8, padding: 10, marginTop: -6, borderRadius: radii.card },
  stoneHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  stoneValue: { fontFamily: fonts.display, fontSize: 17, writingDirection: "ltr" },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 11, writingDirection: "rtl" },
  track: { height: 6, borderRadius: 3, overflow: "hidden", alignSelf: "stretch" },
  trackFill: { height: "100%", borderRadius: 3 },
  stoneNote: { fontFamily: fonts.body, fontSize: 12.5, textAlign: "right", writingDirection: "rtl" },

  sheet: { gap: 14, paddingBottom: 8 },
  sheetScene: { width: "100%", height: 170, borderRadius: radii.card },
  sheetSceneLocked: { opacity: 0.35 },
  sheetBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "right", writingDirection: "rtl" },

  momentsBlock: { gap: 10 },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  moments: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  moment: { flexGrow: 1, flexBasis: "46%", minWidth: 140, borderWidth: 1, borderRadius: radii.card, overflow: "hidden" },
  momentScene: { width: "100%", height: 110 },
  momentLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    padding: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
