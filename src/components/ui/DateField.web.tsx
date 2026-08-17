import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import type { DateFieldProps } from "./DateField";

export type { DateFieldProps };

export function toIsoDay(date: Date) {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Web build of `DateField`. `@react-native-community/datetimepicker` has no web
 * platform, so the field is a real `<input type="date">` — the browser's own
 * calendar popup, which is also what makes the value keyboard-editable.
 *
 * The calendar button calls `showPicker()` (Chrome/Edge/Safari 16+) and falls
 * back to focusing the input where that API is missing.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = "בחירת תאריך",
  helperText,
  error,
  minimumDate,
}: DateFieldProps) {
  const { theme } = useAppTheme();
  const inputRef = React.useRef<any>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Safari throws when the input isn't user-activated yet; fall through.
      }
    }
    el.focus();
  };

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.label }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.inputBg,
            borderColor: error ? theme.danger : theme.inputBorder,
          },
        ]}
      >
        {React.createElement("button", {
          type: "button",
          onClick: openPicker,
          "aria-label": label || placeholder,
          style: {
            width: 30,
            height: 30,
            flex: "0 0 auto",
            border: "none",
            cursor: "pointer",
            borderRadius: 10,
            background: theme.primary,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          },
          children: React.createElement(
            "svg",
            {
              width: 16,
              height: 16,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            },
            React.createElement("rect", {
              key: "r",
              x: 3,
              y: 4,
              width: 18,
              height: 18,
              rx: 2,
            }),
            React.createElement("path", { key: "a", d: "M16 2v4" }),
            React.createElement("path", { key: "b", d: "M8 2v4" }),
            React.createElement("path", { key: "c", d: "M3 10h18" })
          ),
        })}

        {React.createElement("input", {
          ref: inputRef,
          type: "date",
          value,
          min: minimumDate ? toIsoDay(minimumDate) : undefined,
          onChange: (e: any) => onChange(e.target.value),
          style: {
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            color: theme.text,
            fontSize: 15,
            direction: "ltr",
            textAlign: "right",
          },
        })}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textMuted }]}>
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
    textAlign: "right",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 46,
    gap: 10,
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
