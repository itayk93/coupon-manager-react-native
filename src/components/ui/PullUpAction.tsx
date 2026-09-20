import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, type ComposedGesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { TRAVEL_AT_ARM, pullArmed, pullTravel } from "@/lib/pullUp";
import { fonts } from "@/lib/theme";

/**
 * Keep pulling once the page has ended, and the next thing starts.
 *
 * Pull-to-refresh taught everyone that the end of a scroll is a place you can
 * push against, and that pushing past it means something. This is the same
 * bargain at the other end: hold the drag past the last row and a tab rises out
 * of the bottom edge offering the one action the page cannot show you, because
 * it is not on the page — here, a coupon that does not exist yet.
 *
 * What makes it a gesture rather than an accident is that it is reversible in
 * flight. The tab follows the finger the whole way, it says what it will do
 * before it does it, and letting go short of the line puts it back. Nothing
 * happens until the finger lifts, so the whole pull is a question you can still
 * answer "no" to — which is the difference between this and a swipe that fires
 * the moment you cross a line.
 *
 * It never replaces a button. The action is always somewhere tappable too (the
 * add-coupon button, in our case): a gesture with no visible twin is a feature
 * only the people who already found it can use.
 */

/** Below this the page is not scrollable, so there is no "end" to pull past
 *  and an upward swipe is just an upward swipe. */
const SCROLLABLE_SLACK = 4;

function press() {
  if (Platform.OS === "web") return;
  // One buzz, at the instant the pull catches — the moment the screen cannot
  // yet answer "will this fire if I let go now?". Feedback on the way back
  // down, or a second one on release, would spend the signal on something the
  // eye already has.
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export type PullUpAction = {
  gesture: ComposedGesture;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  scrollRef: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
  /** Tab travel in points, for the indicator to read. */
  travel: SharedValue<number>;
  /** 1 once the pull is far enough to fire on release. */
  armed: SharedValue<number>;
};

/**
 * Wire a scroll view up to a pull-past-the-end action.
 *
 * The caller owns both halves — `GestureDetector` around the scroll view,
 * `PullUpIndicator` after it — because the indicator has to sit outside the
 * scrolling content and only the screen knows what else is down there.
 */
export function usePullUpAction({
  onTrigger,
}: {
  onTrigger: () => void;
}): PullUpAction {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const travel = useSharedValue(0);
  const armed = useSharedValue(0);
  // Whether the scroll is resting against its own end, and whether there is an
  // end to rest against. A page shorter than the screen is always technically
  // "at the bottom", and firing on a swipe there would be a trap.
  const atEnd = useSharedValue(0);
  const scrollable = useSharedValue(0);
  // Where the finger was when the page ran out. The pan's own `translationY`
  // is measured from wherever the drag began, which is usually much further up
  // the page, so it cannot be used directly.
  const anchor = useSharedValue<number | null>(null);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event;
    const room = contentSize.height - layoutMeasurement.height;
    scrollable.value = room > SCROLLABLE_SLACK ? 1 : 0;
    atEnd.value = contentOffset.y >= room - 1 ? 1 : 0;
    if (!atEnd.value) anchor.value = null;
  });

  // The scroll view's own gesture, named so the pan can be told to run
  // alongside it rather than instead of it.
  //
  // This has to be a real gesture and not the scroll view's ref. Gesture
  // handler only knows about scrollables it wraps itself — its own `ScrollView`
  // export — and the screen hands us Reanimated's `Animated.ScrollView`, which
  // wraps React Native's. Passing that ref to `simultaneousWithExternalGesture`
  // type-checks and then silently does nothing: no relation is registered, the
  // native scroll claims the touch the moment the finger moves, and the pan is
  // cancelled before it ever reports a single update. Which is exactly how it
  // failed — not intermittently, never.
  //
  // `Gesture.Native()` attaches to whatever the detector wraps, so it works for
  // any scrollable the caller brings.
  const native = Gesture.Native();

  const pan = Gesture.Pan()
    // The scroll view keeps its own gesture. This one reads the same finger
    // rather than taking it away, so the page still scrolls normally and the
    // pull is only what happens after the scrolling has nowhere left to go.
    .simultaneousWithExternalGesture(native)
    .onUpdate((event) => {
      if (!scrollable.value || !atEnd.value) {
        anchor.value = null;
        travel.value = 0;
        armed.value = 0;
        return;
      }
      if (anchor.value === null) anchor.value = event.translationY;
      // Dragging up makes `translationY` more negative, so the distance past
      // the end is the anchor minus where the finger is now.
      travel.value = pullTravel(anchor.value - event.translationY);
      const next = pullArmed(travel.value) ? 1 : 0;
      if (next !== armed.value) {
        armed.value = next;
        if (next) runOnJS(press)();
      }
    })
    .onFinalize(() => {
      const fire = armed.value === 1;
      anchor.value = null;
      armed.value = 0;
      travel.value = withSpring(0, { damping: 18, stiffness: 190 });
      // The finger has left the screen, so the decision is made. Nothing before
      // this point commits to anything.
      if (fire) runOnJS(onTrigger)();
    });

  // Both, together: the detector has to carry the native gesture too, or there
  // is nothing for the pan to run simultaneously *with*.
  const gesture = Gesture.Simultaneous(pan, native);

  return { gesture, scrollHandler, scrollRef, travel, armed };
}

/**
 * The tab itself, riding out of the bottom edge.
 *
 * It is anchored below the screen and pushed up by the pull, so it reads as
 * something being drawn out of the edge rather than something fading in over
 * the page. Presence carries the state the position cannot: half-there while
 * the pull is still short of the line, solid once letting go would fire it.
 */
export function PullUpIndicator({
  travel,
  armed,
  label,
}: {
  travel: SharedValue<number>;
  armed: SharedValue<number>;
  label: string;
}) {
  const { theme } = useAppTheme();

  const slide = useAnimatedStyle(() => ({
    // Fully out is exactly the moment it will fire, so the tab's own position
    // is the answer to "is this armed yet" and the haptic only confirms what
    // the edge of the screen already showed. Clamped at flush: pulling further
    // must not lift it off the edge it is supposed to be coming out of.
    transform: [
      {
        translateY: Math.max(0, HEIGHT * (1 - travel.value / TRAVEL_AT_ARM)),
      },
    ],
    // One colour throughout, because the tab is the action and the action does
    // not change on the way up. What changes is how present it is: half-there
    // while the pull is still a question, solid once letting go would fire it.
    // Tinting the fill instead would mean the label has to change colour with
    // it, and a label that restates what the position already says is noise.
    opacity: travel.value <= 0 ? 0 : armed.value ? 1 : 0.55,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.dock, slide]}>
      <View style={[styles.tab, { backgroundColor: theme.primary }]}>
        <View style={styles.row}>
          <Plus size={16} color="#ffffff" strokeWidth={2.8} />
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

/** Tall enough to read at a glance, short enough that the threshold sits above
 *  it rather than off the screen. */
const HEIGHT = 56;

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  tab: {
    minWidth: 150,
    height: HEIGHT,
    paddingHorizontal: 22,
    // Rounded across the top only: the flat foot keeps it attached to the edge
    // it is coming out of, which is what makes it read as emerging rather than
    // floating.
    borderTopLeftRadius: HEIGHT / 2,
    borderTopRightRadius: HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
  },
  label: {
    color: "#ffffff",
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    writingDirection: "rtl",
  },
});
