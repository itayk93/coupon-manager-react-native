import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { Button } from "./button";
import { Kuponi } from "@/components/ui/Kuponi";
import { SpeechBubble } from "@/components/ui/SpeechBubble";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
  largeVisual?: boolean;
  visual?: React.ReactNode;
};

export function EmptyState({
  icon,
  title,
  subtitle,
  actionTitle,
  onAction,
  style,
  largeVisual = false,
  visual,
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
      {/* An empty list is exactly when someone should explain, so the headline
          is Kuponi's line rather than a label floating above a drawing. */}
      <View style={styles.stage}>
        {visual ?? (
          <Kuponi
            state="talking"
            size={largeVisual ? "large" : "medium"}
          />
        )}
        <SpeechBubble text={title} tail="up" isHeading style={styles.bubble} />
      </View>

      {icon ? <View style={[styles.iconBadge, { backgroundColor: theme.coralBg, borderColor: theme.coralBorder }]}>{icon}</View> : null}

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
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -16,
    marginBottom: 8,
  },
  stage: {
    alignItems: "center",
    alignSelf: "stretch",
    gap: 10,
    marginBottom: 10,
  },
  bubble: {
    maxWidth: 300,
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
