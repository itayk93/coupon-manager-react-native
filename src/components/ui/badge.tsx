import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "secondary" | "outline";

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
};

export function Badge({
  label,
  variant = "default",
  style,
  textStyle,
  icon,
}: BadgeProps) {
  const { theme } = useAppTheme();

  const getColors = () => {
    switch (variant) {
      case "success":
        return { bg: theme.successBg, text: theme.successText, border: "transparent" };
      case "warning":
        return { bg: theme.warningBg, text: theme.warningText, border: "transparent" };
      case "danger":
        return { bg: theme.dangerBg, text: theme.dangerText, border: "transparent" };
      case "secondary":
        return { bg: theme.primaryTint, text: theme.primaryDark, border: "transparent" };
      case "outline":
        return { bg: "transparent", text: theme.textMuted, border: theme.inputBorder };
      case "default":
      default:
        return { bg: theme.neutralBg, text: theme.neutralText, border: "transparent" };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {icon ? <View style={{ marginLeft: 4 }}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    fontWeight: "800",
  },
});
