import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";

export type DateFieldProps = {
  label?: string;
  /** `YYYY-MM-DD`, or an empty string when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  minimumDate?: Date;
};

export function toIsoDay(date: Date) {
  // Local getters, not toISOString(): the UTC shift would roll the day back for
  // Israel-time midnight picks.
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function parseIsoDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Tap-to-pick date field: the native `UIDatePicker` / `DatePickerDialog` via
 * `@react-native-community/datetimepicker` (see `DateField.web.tsx` for the
 * `<input type="date">` variant the web build uses instead).
 *
 * The value stays a `YYYY-MM-DD` string so callers keep talking to Supabase in
 * the shape the `expiration` column expects.
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
  const [open, setOpen] = React.useState(false);

  const selected = parseIsoDay(value);

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.label }]}>{label}</Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        style={[
          styles.field,
          {
            backgroundColor: theme.inputBg,
            borderColor: error ? theme.danger : theme.inputBorder,
          },
        ]}
      >
        <View style={[styles.iconBtn, { backgroundColor: theme.primary }]}>
          <Calendar size={16} color="#ffffff" />
        </View>

        <Text
          style={[
            styles.valueText,
            { color: selected ? theme.text : theme.textSubtle },
          ]}
        >
          {selected ? value : placeholder}
        </Text>
      </TouchableOpacity>

      {open ? (
        <DateTimePicker
          value={selected || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minimumDate}
          onChange={(event, date) => {
            if (Platform.OS !== "ios") setOpen(false);
            if (event.type === "dismissed") {
              setOpen(false);
              return;
            }
            if (date) onChange(toIsoDay(date));
          }}
        />
      ) : null}

      {open && Platform.OS === "ios" ? (
        <TouchableOpacity onPress={() => setOpen(false)} style={styles.doneBtn}>
          <Text style={[styles.doneText, { color: theme.primary }]}>סיום</Text>
        </TouchableOpacity>
      ) : null}

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
    // row-reverse: the calendar button sits on the left edge in this RTL layout,
    // matching the eye button in `Input`.
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 46,
    gap: 10,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    textAlign: "right",
    writingDirection: "ltr",
  },
  doneBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  doneText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
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
