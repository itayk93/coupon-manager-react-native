import React, { useEffect, useRef } from "react";
import { Animated as NativeAnimated, Dimensions, PanResponder, StyleSheet, View } from "react-native";
import { MascotAnimation, type MascotState } from "@/components/ui/MascotAnimation";

export type CharacterState = MascotState;
const EDGE_GUARD = 28;

/** Public props stay compatible; every role now uses the original blue mascot. */
export function CharacterScene({ state, reduceMotion, compact }: {
  state: CharacterState; reduceMotion?: boolean; compact?: boolean;
}) {
  return <View style={styles.scene}>
    <MascotAnimation state={state} reduceMotion={reduceMotion} size={compact ? 144 : 192} />
  </View>;
}

export function CharacterSpotlight({ state = "talking", reduceMotion, size = "medium" }: {
  character: "investigator" | "helper";
  state?: CharacterState;
  reduceMotion?: boolean;
  size?: "small" | "medium" | "large";
  tone?: "mint" | "blue" | "success" | "coral" | "none";
}) {
  return <MascotAnimation state={state} reduceMotion={reduceMotion}
    size={size === "small" ? 88 : size === "large" ? 176 : 132} />;
}

export function FloatingMascot({
  size = 88,
  initial,
  bottomInset = 8,
  leftInset = EDGE_GUARD,
  reduceMotion,
}: {
  character?: "investigator" | "helper";
  /** Rendered height in points; the rig scales to fit it. */
  size?: number;
  /** Starting offset from the resting spot, in points. */
  initial?: { x: number; y: number };
  /** Gap kept above the tab bar at rest. */
  bottomInset?: number;
  /** Gap kept from the left edge at rest. */
  leftInset?: number;
  reduceMotion?: boolean;
}) {
  const width = size;

  const screen = Dimensions.get("window");
  // The mascot rests bottom-left, just above the tab bar; anchoring the view
  // there and dragging from {0,0} keeps the resting spot correct on every
  // screen height instead of computing a top offset that drifts per device.
  const start = initial ?? { x: 0, y: 0 };
  const pan = useRef(new NativeAnimated.ValueXY(start)).current;
  const position = useRef({ ...start });
  const grabbed = useRef(new NativeAnimated.Value(0)).current;
  const tilt = useRef(new NativeAnimated.Value(0)).current;

  useEffect(() => {
    const id = pan.addListener((value) => { position.current = value; });
    return () => pan.removeListener(id);
  }, [pan]);

  const responder = useRef(
    PanResponder.create({
      // Claim the gesture only once it is a real drag, so a scroll that starts
      // on the mascot still scrolls the list underneath.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        pan.setOffset({ ...position.current });
        pan.setValue({ x: 0, y: 0 });
        NativeAnimated.spring(grabbed, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
      },
      // Written out rather than through `Animated.event` so the same handler
      // can drive the tilt: lean into the direction of travel. A body that
      // translates without rotating reads as a cursor dragging an image; the
      // tilt is what makes it read as weight being pulled along.
      onPanResponderMove: (_e, g) => {
        pan.setValue({ x: g.dx, y: g.dy });
        tilt.setValue(Math.max(-14, Math.min(14, g.vx * 9)));
      },
      onPanResponderRelease: (_e, g) => {
        pan.flattenOffset();
        NativeAnimated.spring(grabbed, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
        NativeAnimated.spring(tilt, { toValue: 0, useNativeDriver: true, friction: 4, tension: 90 }).start();

        // Offsets are relative to the bottom-left rest spot: x grows right,
        // y grows down, so the reachable box is x >= 0 and y <= 0.
        const maxX = Math.max(0, screen.width - width - leftInset - 8);
        // x >= 0 already keeps it out of the back-gesture strip, since the
        // rest spot sits at leftInset.
        const minY = -Math.max(0, screen.height - size - 160);
        const settle = () => {
          // A mascot flung past the bezel can never be dragged back, so it
          // always ends inside the reachable box.
          const x = Math.min(Math.max(position.current.x, 0), maxX);
          const y = Math.min(Math.max(position.current.y, minY), 0);
          if (x === position.current.x && y === position.current.y) return;
          NativeAnimated.spring(pan, { toValue: { x, y }, useNativeDriver: false, friction: 6, tension: 70 }).start();
        };

        // Carry the throw: `decay` keeps the release velocity and bleeds it off,
        // instead of the mascot stopping dead the instant the finger lifts.
        const flick = NativeAnimated.decay(pan, {
          velocity: { x: g.vx, y: g.vy },
          deceleration: 0.994,
          useNativeDriver: false,
        });
        // Cut the slide short the moment it leaves the box, then spring back —
        // letting decay run to a stop first would send it far off screen and
        // make the return trip feel like a separate animation.
        const guard = pan.addListener(({ x, y }) => {
          if (x < -24 || x > maxX + 24 || y > 24 || y < minY - 24) {
            flick.stop();
          }
        });
        flick.start(() => {
          pan.removeListener(guard);
          settle();
        });
      },
    })
  ).current;

  const liftStyle = {
    transform: [
      { scale: grabbed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
      { rotate: tilt.interpolate({ inputRange: [-14, 14], outputRange: ["14deg", "-14deg"] }) },
    ],
  };

  return (
    <NativeAnimated.View
      {...responder.panHandlers}
      // A rig is mostly round, so its corners are dead space; the slop gives
      // back the points a finger aims at but misses.
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityElementsHidden
      style={[styles.floating, { width, height: size, left: leftInset, bottom: bottomInset, transform: pan.getTranslateTransform() }]}
    >
      <NativeAnimated.View style={liftStyle}>
        <MascotAnimation size={size} state="calm" reduceMotion={reduceMotion} />
      </NativeAnimated.View>
    </NativeAnimated.View>
  );
}


const styles = StyleSheet.create({
  scene: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  floating: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 20 },
});
