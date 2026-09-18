import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
};

export function Input({
  label,
  error,
  helperText,
  icon,
  containerStyle,
  isPassword = false,
  secureTextEntry,
  style,
  ...rest
}: InputProps) {
  const { theme } = useAppTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text maxFontSizeMultiplier={1.35} style={[styles.label, { color: theme.label, textAlign: "right" }]}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.inputBg,
            borderColor: error
              ? theme.danger
              : isFocused
              ? theme.primary
              : theme.inputBorder,
          },
        ]}
      >
        {/*
          * The row is reversed, so this first child lands on the right — where
          * Hebrew starts reading and where a field's own icon belongs. The eye
          * comes last and lands on the left, because revealing a password is
          * an action on the field, not a label for it. Before this the eye
          * stood in the icon's place and the icon was dropped on the floor:
          * every password field asked for a lock and got none.
          */}
        {icon ? <View style={styles.iconContainer}>{icon}</View> : null}

        <TextInput
          {...rest}
          maxFontSizeMultiplier={1.35}
          secureTextEntry={isPassword ? !showPassword : secureTextEntry}
          placeholderTextColor={theme.textSubtle}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            {
              color: theme.text,
              textAlign: "right",
            },
            style,
          ]}
        />

        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
          >
            {showPassword ? (
              <EyeOff size={18} color={theme.textMuted} />
            ) : (
              <Eye size={18} color={theme.textMuted} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text maxFontSizeMultiplier={1.35} style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text maxFontSizeMultiplier={1.35} style={[styles.helperText, { color: theme.textMuted }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
    width: "100%",
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 46,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingVertical: 6,
  },
  eyeButton: {
    padding: 4,
    marginRight: 6,
  },
  // Sits at the right edge of a reversed row, so the breathing room the text
  // needs is on its left.
  iconContainer: {
    marginLeft: 6,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
});
