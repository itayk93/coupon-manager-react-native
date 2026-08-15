import React from "react";
import { View, StyleSheet, ViewStyle, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
};

export function Card({ children, style, onPress }: CardProps) {
  const { theme } = useAppTheme();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.card,
      borderColor: theme.cardBorder,
      shadowColor: theme.isDark ? "#000000" : "#64748b",
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
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
});
