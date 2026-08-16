import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, shadows } from "@/lib/theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "warning";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { theme } = useAppTheme();

  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  const getBackgroundColor = () => {
    if (disabled) return theme.surfaceAlt;
    switch (variant) {
      case "primary":
        return theme.primary;
      case "secondary":
        return theme.secondary;
      case "danger":
        return theme.danger;
      case "warning":
        return theme.warning;
      case "outline":
        return theme.card;
      case "ghost":
        return "transparent";
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.textSubtle;
    switch (variant) {
      case "primary":
      case "secondary":
      case "danger":
      case "warning":
        return "#ffffff";
      case "outline":
        return theme.label;
      case "ghost":
        return theme.textMuted;
    }
  };

  const getPadding = () => {
    switch (size) {
      case "sm":
        return { height: 40, paddingHorizontal: 16, borderRadius: 11 };
      case "lg":
        return { height: 48, paddingHorizontal: 24, borderRadius: 12 };
      case "md":
      default:
        return { height: 46, paddingHorizontal: 18, borderRadius: 12 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return 12.5;
      case "lg":
        return 15;
      case "md":
      default:
        return 14;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === "outline" ? theme.inputBorder : "transparent",
          borderWidth: variant === "outline" ? 1 : 0,
        },
        variant === "primary" && !disabled ? shadows.brand : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon ? <>{icon}</> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    textAlign: "center",
  },
});
