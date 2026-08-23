import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, palette } from "@/lib/theme";

type CouponCodeBoxProps = {
  code: string;
  cardExp?: string | null;
  cvv?: string | null;
  /** Shown above the box. Pass null on surfaces that already have a heading. */
  label?: string | null;
  onPress?: () => void;
};

/**
 * The redemption code exactly as the coupon page shows it: dashed green frame,
 * monospaced digits, and the card expiry and CVV underneath when the coupon
 * carries them.
 *
 * The quick-view modal used to print the code as plain text and drop the expiry
 * and CVV entirely, which made a prepaid card unusable from the dashboard. Both
 * surfaces render this component so the code always reads the same way.
 */
export function CouponCodeBox({
  code,
  cardExp,
  cvv,
  label = "קוד למימוש בקופה / באתר",
  onPress,
}: CouponCodeBoxProps) {
  const { theme, isDark } = useAppTheme();

  const frame = isDark ? "rgba(22, 163, 74, 0.3)" : "rgba(22, 163, 74, 0.2)";
  const fill = isDark ? "rgba(22, 163, 74, 0.12)" : "rgba(22, 163, 74, 0.08)";

  const Box = onPress ? TouchableOpacity : View;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      ) : null}

      <Box
        {...(onPress ? { onPress, activeOpacity: 0.7, accessibilityRole: "button" as const } : {})}
        style={[styles.box, { backgroundColor: fill, borderColor: frame }]}
      >
        <Text style={[styles.code, { color: palette.success }]} selectable>
          {code || "—"}
        </Text>

        {cardExp || cvv ? (
          <View style={[styles.detailsRow, { borderTopColor: frame }]}>
            {cardExp ? (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>תוקף כרטיס:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]} selectable>
                  {cardExp}
                </Text>
              </View>
            ) : null}

            {cardExp && cvv ? (
              <View style={[styles.detailDivider, { backgroundColor: frame }]} />
            ) : null}

            {cvv ? (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>CVV:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]} selectable>
                  {cvv}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Box>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  box: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  code: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  detailsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    marginTop: 14,
    paddingTop: 14,
    paddingHorizontal: 8,
  },
  detailItem: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 8,
  },
  detailLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
  },
  detailValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  detailDivider: {
    width: 1.5,
    height: 28,
  },
});
