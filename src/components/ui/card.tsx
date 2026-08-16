import React from "react";
import { Text, View, StyleSheet, ViewStyle, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { radii, shadows } from "@/lib/theme";

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
};

export function Card({ children, style, onPress }: CardProps) {
  const { theme } = useAppTheme();

  const cardStyle = [
    styles.card,
    shadows.card,
    {
      backgroundColor: theme.card,
      borderColor: theme.cardBorder,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

export const CardHeader = View;
export const CardTitle = Text;
export const CardDescription = Text;
export const CardContent = View;
export const CardFooter = View;

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 16,
  },
});
