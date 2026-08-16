import { Platform, StyleSheet } from "react-native";

/**
 * Design tokens from "Coupon Master - Redesign".
 *
 * The redesign is a light, warm-neutral system with a blue brand — it replaces
 * the previous dark-first emerald theme. Dark mode is kept (the settings toggle
 * still works) and re-derived from the same brand blue rather than dropped.
 */
export const palette = {
  // Brand
  primary: "#1f6fd1",
  primaryDark: "#154a8f",
  primaryDeep: "#1a5fc0",
  primaryLight: "#5b9bd8",
  primaryTint: "#e8f2fd",
  primaryMuted: "rgba(31, 111, 209, 0.12)",

  secondary: "#5b9bd8",
  accent: "#7c3aed",
  info: "#154a8f",

  // Status
  success: "#16a34a",
  successBg: "#dcfce7",
  successText: "#15803d",
  warning: "#f59e0b",
  warningBg: "#fef3c7",
  warningText: "#b45309",
  danger: "#dc2626",
  dangerBg: "#fee2e2",
  dangerBorder: "#fecaca",
  dangerText: "#b91c1c",
  neutralBg: "#f3f4f6",
  neutralText: "#6b7280",

  // Light surfaces
  lightShell: "#eeece5",
  lightBg: "#faf9f6",
  lightCard: "#ffffff",
  lightCardBorder: "#e6e9ef",
  lightSurface: "#f2f3fd",
  lightSurfaceAlt: "#eef0f3",
  lightTrack: "#f0f1f6",
  lightDivider: "#f0f1f4",
  lightInput: "#f4f5fd",
  lightInputBorder: "#d7dce4",
  lightText: "#101828",
  lightTextSecondary: "#475467",
  lightTextMuted: "#667085",
  lightTextSubtle: "#98a2b3",
  lightLabel: "#344054",

  // The app chrome is intentionally dark in both modes
  headerBg: "#15202e",

  // Dark surfaces, re-derived from the brand blue
  darkBg: "#0d1520",
  darkCard: "#15202e",
  darkCardBorder: "#22303f",
  darkSurface: "#1b2836",
  darkTrack: "#22303f",
  darkDivider: "#22303f",
  darkInput: "#1b2836",
  darkInputBorder: "#2b3a4b",
  darkText: "#f5f7fa",
  darkTextSecondary: "#c2cbd6",
  darkTextMuted: "#94a3b8",
  darkTextSubtle: "#6b7c8f",
  darkLabel: "#dbe2ea",

  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

/** Display face for headings/figures; body face for everything else. */
export const fonts = {
  display: Platform.select({ web: "Outfit, Heebo, sans-serif", default: "Outfit_800ExtraBold" }) as string,
  displaySemi: Platform.select({ web: "Outfit, Heebo, sans-serif", default: "Outfit_600SemiBold" }) as string,
  body: Platform.select({ web: "Heebo, sans-serif", default: "Heebo_400Regular" }) as string,
  bodyMedium: Platform.select({ web: "Heebo, sans-serif", default: "Heebo_500Medium" }) as string,
  bodyBold: Platform.select({ web: "Heebo, sans-serif", default: "Heebo_700Bold" }) as string,
};

export const radii = {
  sm: 8,
  md: 11,
  lg: 12,
  xl: 14,
  card: 16,
  cardLg: 18,
  hero: 20,
  sheet: 22,
  pill: 999,
};

export type ThemeMode = "dark" | "light";

export function getTheme(mode: ThemeMode) {
  const isDark = mode === "dark";
  return {
    isDark,

    // Surfaces
    background: isDark ? palette.darkBg : palette.lightBg,
    shell: isDark ? palette.darkBg : palette.lightShell,
    card: isDark ? palette.darkCard : palette.lightCard,
    cardBorder: isDark ? palette.darkCardBorder : palette.lightCardBorder,
    surface: isDark ? palette.darkSurface : palette.lightSurface,
    surfaceAlt: isDark ? palette.darkSurface : palette.lightSurfaceAlt,
    track: isDark ? palette.darkTrack : palette.lightTrack,
    divider: isDark ? palette.darkDivider : palette.lightDivider,
    inputBg: isDark ? palette.darkInput : palette.lightInput,
    inputBorder: isDark ? palette.darkInputBorder : palette.lightInputBorder,
    headerBg: palette.headerBg,

    // Type
    text: isDark ? palette.darkText : palette.lightText,
    textSecondary: isDark ? palette.darkTextSecondary : palette.lightTextSecondary,
    textMuted: isDark ? palette.darkTextMuted : palette.lightTextMuted,
    textSubtle: isDark ? palette.darkTextSubtle : palette.lightTextSubtle,
    label: isDark ? palette.darkLabel : palette.lightLabel,

    // Brand
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    primaryDeep: palette.primaryDeep,
    primaryLight: palette.primaryLight,
    primaryTint: isDark ? "rgba(31, 111, 209, 0.18)" : palette.primaryTint,
    primaryMuted: palette.primaryMuted,
    secondary: palette.secondary,
    accent: palette.accent,
    info: palette.info,

    // Status
    success: palette.success,
    successBg: isDark ? "rgba(22, 163, 74, 0.18)" : palette.successBg,
    successText: isDark ? "#4ade80" : palette.successText,
    warning: palette.warning,
    warningBg: isDark ? "rgba(245, 158, 11, 0.18)" : palette.warningBg,
    warningText: isDark ? "#fbbf24" : palette.warningText,
    danger: palette.danger,
    dangerBg: isDark ? "rgba(220, 38, 38, 0.18)" : palette.dangerBg,
    dangerBorder: isDark ? "rgba(220, 38, 38, 0.35)" : palette.dangerBorder,
    dangerText: isDark ? "#f87171" : palette.dangerText,
    neutralBg: isDark ? palette.darkSurface : palette.neutralBg,
    neutralText: isDark ? palette.darkTextMuted : palette.neutralText,

    border: isDark ? palette.darkCardBorder : palette.lightCardBorder,
  };
}

export type AppTheme = ReturnType<typeof getTheme>;

/** Card elevation from the design: a barely-there lift, not a drop shadow. */
export const shadows = {
  card: {
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  lifted: {
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  brand: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 6,
  },
};

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
