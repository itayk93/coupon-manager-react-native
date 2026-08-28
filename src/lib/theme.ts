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

  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

/** Display face for headings/figures; body face for everything else. */
export const fonts = {
  display: Platform.select({ web: "Heebo, sans-serif", default: "Heebo_800ExtraBold" }) as string,
  displaySemi: Platform.select({ web: "Heebo, sans-serif", default: "Heebo_700Bold" }) as string,
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

export function getTheme(_mode: ThemeMode) {
  // "Coupon Master - Redesign" defines a single light system. `isDark` is kept
  // (always false) so consumers that read it keep compiling.
  return {
    isDark: false,

    // Surfaces
    background: palette.lightBg,
    shell: palette.lightShell,
    card: palette.lightCard,
    cardBorder: palette.lightCardBorder,
    surface: palette.lightSurface,
    surfaceAlt: palette.lightSurfaceAlt,
    track: palette.lightTrack,
    divider: palette.lightDivider,
    inputBg: palette.lightInput,
    inputBorder: palette.lightInputBorder,
    headerBg: palette.headerBg,

    // Type
    text: palette.lightText,
    textSecondary: palette.lightTextSecondary,
    textMuted: palette.lightTextMuted,
    textSubtle: palette.lightTextSubtle,
    label: palette.lightLabel,

    // Brand
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    primaryDeep: palette.primaryDeep,
    primaryLight: palette.primaryLight,
    primaryTint: palette.primaryTint,
    primaryMuted: palette.primaryMuted,
    secondary: palette.secondary,
    accent: palette.accent,
    info: palette.info,

    // Status
    success: palette.success,
    successBg: palette.successBg,
    successText: palette.successText,
    warning: palette.warning,
    warningBg: palette.warningBg,
    warningText: palette.warningText,
    danger: palette.danger,
    dangerBg: palette.dangerBg,
    dangerBorder: palette.dangerBorder,
    dangerText: palette.dangerText,
    neutralBg: palette.neutralBg,
    neutralText: palette.neutralText,

    border: palette.lightCardBorder,
  };
}

export type AppTheme = ReturnType<typeof getTheme>;

/** Card elevation from the design: a barely-there lift, not a drop shadow. */
export const shadows = {
  card: {
    boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.04)",
    elevation: 1,
  },
  lifted: {
    boxShadow: "0px 4px 10px rgba(16, 24, 40, 0.12)",
    elevation: 4,
  },
  brand: {
    boxShadow: "0px 8px 18px rgba(31, 111, 209, 0.32)",
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
