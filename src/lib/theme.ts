import { StyleSheet } from "react-native";

export const palette = {
  // Brand & Accent Colors
  primary: "#10b981", // Emerald Green (matching the logo & brand)
  primaryDark: "#059669",
  primaryLight: "#d1fae5",
  primaryMuted: "rgba(16, 185, 129, 0.12)",

  secondary: "#3b82f6", // Royal Blue
  secondaryDark: "#2563eb",
  secondaryLight: "#dbeafe",

  accent: "#8b5cf6", // Purple
  warning: "#f59e0b", // Amber
  warningLight: "#fef3c7",
  danger: "#ef4444", // Rose Red
  dangerLight: "#fee2e2",
  info: "#06b6d4", // Cyan

  // Slate & Dark mode tokens
  darkBg: "#090d16",
  darkCard: "#111827",
  darkCardBorder: "#1f2937",
  darkSurface: "#1e293b",
  darkInput: "#1e293b",
  darkText: "#f8fafc",
  darkTextMuted: "#94a3b8",
  darkTextSubtle: "#64748b",

  // Light mode tokens
  lightBg: "#f8fafc",
  lightCard: "#ffffff",
  lightCardBorder: "#e2e8f0",
  lightSurface: "#f1f5f9",
  lightInput: "#f8fafc",
  lightText: "#0f172a",
  lightTextMuted: "#64748b",
  lightTextSubtle: "#94a3b8",

  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

export type ThemeMode = "dark" | "light";

export function getTheme(mode: ThemeMode) {
  const isDark = mode === "dark";
  return {
    isDark,
    background: isDark ? palette.darkBg : palette.lightBg,
    card: isDark ? palette.darkCard : palette.lightCard,
    cardBorder: isDark ? palette.darkCardBorder : palette.lightCardBorder,
    surface: isDark ? palette.darkSurface : palette.lightSurface,
    inputBg: isDark ? palette.darkInput : palette.lightInput,
    text: isDark ? palette.darkText : palette.lightText,
    textMuted: isDark ? palette.darkTextMuted : palette.lightTextMuted,
    textSubtle: isDark ? palette.darkTextSubtle : palette.lightTextSubtle,
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    primaryLight: palette.primaryLight,
    primaryMuted: palette.primaryMuted,
    secondary: palette.secondary,
    warning: palette.warning,
    danger: palette.danger,
    info: palette.info,
    border: isDark ? "#334155" : "#e2e8f0",
  };
}

export const globalStyles = StyleSheet.create({
  rtlRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  rtlRowBetween: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
