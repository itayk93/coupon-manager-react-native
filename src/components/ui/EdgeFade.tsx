import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Soft fade at both ends of a horizontal scroller, so chips dissolve into the
 * background instead of being cut off by a hard edge.
 *
 * `color` must be a 6-digit hex of the surface behind the scroller. The clear
 * end is the same colour at alpha 0 — not the keyword "transparent", which is
 * black at alpha 0 and drags the gradient through grey.
 */
export function EdgeFade({ color, width = 20, children }: {
  color: string;
  width?: number;
  children: React.ReactNode;
}) {
  const clear = `${color}00`;
  return (
    <View>
      {children}
      <LinearGradient
        pointerEvents="none"
        colors={[color, clear]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.edge, { left: 0, width }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[clear, color]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.edge, { right: 0, width }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { position: "absolute", top: 0, bottom: 0 },
});
