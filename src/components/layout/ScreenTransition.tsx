import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useNativeDriver } from "@/lib/animation";

/**
 * The move from one screen to the next, on web.
 *
 * `animation: "slide_from_right"` on the Stack is a native-stack option, and
 * native-stack on web has no animations to give it: screens are swapped in
 * place, so a tab, a coupon or the whole app after signing in simply replaced
 * what was there between two frames. Native needs none of this and gets none —
 * the wrapper is not even in its tree.
 *
 * A fade with a short rise rather than a slide: the app is laid out right to
 * left by hand while the document stays `dir="ltr"` (see `webDocumentHead.ts`),
 * so there is no one direction here that is reliably "forward", and a push
 * animation that runs the wrong way reads worse than no push at all.
 */

type Props = { children: ReactNode };

const DURATION = 170;
const RISE = 8;

function WebScreenTransition({ children }: Props) {
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const launched = useRef(false);

  useEffect(() => {
    // The first screen of a session arrives behind the launch screen. It was
    // not navigated to, and animating it would only delay the app.
    if (!launched.current) {
      launched.current = true;
      return;
    }
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
    });
    run.start();
    // Stopping mid-flight would leave the screen part-way transparent, so the
    // value is put back before the next run — never left where it stopped.
    return () => {
      run.stop();
      progress.setValue(1);
    };
  }, [pathname, reduceMotion, progress]);

  return (
    <Animated.View
      style={[
        styles.screen,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export const ScreenTransition =
  Platform.OS === "web" ? WebScreenTransition : ({ children }: Props) => <>{children}</>;

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
