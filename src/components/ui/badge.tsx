import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";

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
        return {
          bg: theme.isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5",
          text: theme.isDark ? "#34d399" : "#065f46",
          border: theme.isDark ? "#059669" : "#a7f3d0",
        };
      case "warning":
        return {
          bg: theme.isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7",
          text: theme.isDark ? "#fbbf24" : "#92400e",
          border: theme.isDark ? "#d97706" : "#fde68a",
        };
      case "danger":
        return {
          bg: theme.isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
          text: theme.isDark ? "#f87171" : "#991b1b",
          border: theme.isDark ? "#dc2626" : "#fecaca",
        };
      case "secondary":
        return {
          bg: theme.isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe",
          text: theme.isDark ? "#60a5fa" : "#1e40af",
          border: theme.isDark ? "#2563eb" : "#bfdbfe",
        };
      case "outline":
        return {
          bg: "transparent",
          text: theme.textMuted,
          border: theme.border,
        };
      case "default":
      default:
        return {
          bg: theme.isDark ? "#1e293b" : "#f1f5f9",
          text: theme.text,
          border: theme.border,
        };
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});
