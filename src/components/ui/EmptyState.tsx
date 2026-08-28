import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { Button } from "./button";

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
  largeVisual?: boolean;
};

export function EmptyState({
  icon,
  title,
  subtitle,
  actionTitle,
  onAction,
  style,
  largeVisual = false,
}: EmptyStateProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
        },
        style,
      ]}
    >
      <View
        style={[
        largeVisual ? styles.visualStage : styles.iconCircle,
          { backgroundColor: largeVisual ? "transparent" : theme.surfaceAlt },
        ]}
      >
        {icon}
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        {subtitle}
      </Text>

      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          style={styles.actionButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  visualStage: {
    width: 112,
    height: 132,
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  actionButton: {
    marginTop: 18,
  },
});
