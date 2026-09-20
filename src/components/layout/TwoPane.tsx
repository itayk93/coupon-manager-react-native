import React from "react";
import { StyleSheet, View } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import { listPaneWidth } from "@/lib/responsive";

type Props = {
  /** The pane that keeps its natural width; sits on the right, where reading starts. */
  primary: React.ReactNode;
  /** Takes whatever is left over. */
  secondary: React.ReactNode;
  primaryWidth?: number;
  gap?: number;
};

/**
 * The duo layout: two columns on a screen wide enough for both, one stack
 * everywhere else.
 *
 * On a phone — and on an iPad in portrait, where a second column would only
 * make two narrow ones — it renders `primary` then `secondary` in that order,
 * which is exactly the single column the app already had. Nothing is hidden by
 * the split and nothing is added by it; the same content changes shape.
 */
export function TwoPane({ primary, secondary, primaryWidth, gap = 16 }: Props) {
  const { canSplit, contentWidth } = useResponsive();

  if (!canSplit) {
    return (
      <>
        {primary}
        {secondary}
      </>
    );
  }

  return (
    <View style={[styles.row, { gap }]}>
      <View style={{ width: primaryWidth ?? listPaneWidth(contentWidth) }}>{primary}</View>
      <View style={styles.rest}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    // row-reverse: the primary pane belongs on the right.
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },
  rest: {
    flex: 1,
    minWidth: 0,
  },
});
