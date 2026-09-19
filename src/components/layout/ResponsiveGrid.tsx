import React from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";

type Props = {
  children: React.ReactNode;
  /** The narrowest a child may get before a column is dropped. */
  minItemWidth?: number;
  maxColumns?: number;
  gap?: number;
  /**
   * Space between rows. Zero by default: most card components carry their own
   * bottom margin, and adding to it would double the rhythm. Screens that
   * space their cards with a container `gap` pass that value here, since the
   * grid — not the container — is the cards' parent once it kicks in.
   */
  rowGap?: number;
  style?: ViewStyle;
};

/**
 * Lays a list of cards out in as many columns as the screen can hold.
 *
 * On a phone it is a pass-through: one column, no wrapper views, the same tree
 * that shipped. It only becomes a grid once the cards would otherwise be
 * stretched across an iPad.
 *
 * Widths are percentages rather than measured pixels, so the grid is right on
 * the first frame — a Split View drag would otherwise show one column until a
 * layout pass caught up.
 */
export function ResponsiveGrid({
  children,
  minItemWidth = 320,
  maxColumns = 3,
  gap = 14,
  rowGap = 0,
  style,
}: Props) {
  const { columns } = useResponsive();
  const count = columns(minItemWidth, maxColumns, gap);
  const items = React.Children.toArray(children).filter(Boolean);

  if (count <= 1 || items.length <= 1) return <>{children}</>;

  return (
    <View style={[styles.grid, { marginHorizontal: -gap / 2, marginBottom: -rowGap }, style]}>
      {items.map((child, index) => (
        <View
          // The children are a rendered list; their own keys ride along inside.
          key={index}
          style={{ width: `${100 / count}%`, paddingHorizontal: gap / 2, marginBottom: rowGap }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    // row-reverse: the first card belongs at the right, where Hebrew starts.
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
});
