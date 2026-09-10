import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useCoupons } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";
import { fonts, radii } from "@/lib/theme";
import {
  WIDGET_DEBUG_CELEBRATIONS,
  WIDGET_DEBUG_STATES,
  applyWidgetDebugToken,
  syncWidget,
} from "@/lib/widgetSync";
import {
  clearWidgetDebugOverride,
  loadWidgetDebugOverride,
  setWidgetDebugOverride,
} from "@/lib/widgetDebugOverride";
import { isWidgetSupported } from "../../modules/coupon-widget";

/**
 * Admin-only. Forces the home-screen widget into any expiry scene (1..9) or
 * celebration scene and pins it there until released — real coupon changes no
 * longer overwrite the choice. Rendered both on the widget settings screen and
 * as a tab in the admin dashboard.
 */
export function WidgetDebugPanel() {
  const { theme } = useAppTheme();
  const { data: coupons = [] } = useCoupons();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    void loadWidgetDebugOverride().then(setToken);
  }, []);

  const pick = (next: string, label: string) => {
    void setWidgetDebugOverride(next);
    setToken(next);
    applyWidgetDebugToken(next, coupons);
    notify.success(`הווידג'ט נעול על ${label}`);
  };

  const clear = () => {
    void clearWidgetDebugOverride().then(() => void syncWidget(coupons));
    setToken(null);
    notify.success("הווידג'ט חזר לנתונים האמיתיים");
  };

  const chip = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? theme.primary : theme.background,
      borderColor: active ? theme.primary : theme.cardBorder,
    },
  ];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: token != null ? theme.primaryTint : theme.card,
          borderColor: token != null ? theme.primary : theme.cardBorder,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>🐞 דיבאג — נעילת מצב הווידג'ט</Text>

      {!isWidgetSupported ? (
        <Text style={[styles.hint, { color: theme.textSubtle }]}>
          ווידג'ט זמין רק בבנייה נייטיבית (לא ב־Expo Go / ווב).
        </Text>
      ) : (
        <Text style={[styles.hint, { color: theme.textSubtle }]}>
          {token != null
            ? "הווידג'ט נעול. גם קופון שפג לא ישנה אותו עד שחרור."
            : "בחר מצב כדי לנעול עליו את הווידג'ט על המכשיר, גם אם אין קופון שפג."}
        </Text>
      )}

      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>ספירת תפוגה</Text>
      <View style={styles.grid}>
        {WIDGET_DEBUG_STATES.map(({ state, label }) => {
          const value = String(state);
          const active = token === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => pick(value, `מצב ${state} · ${label}`)}
              style={chip(active)}
            >
              <Text style={[styles.chipNum, { color: active ? "#fff" : theme.primary }]}>
                {state}
              </Text>
              <Text
                style={[styles.chipLabel, { color: active ? "#fff" : theme.textMuted }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>חגיגות</Text>
      <View style={styles.grid}>
        {WIDGET_DEBUG_CELEBRATIONS.map(({ kind, label }) => {
          const active = token === kind;
          return (
            <TouchableOpacity key={kind} onPress={() => pick(kind, label)} style={chip(active)}>
              <Text
                style={[styles.chipLabel, { color: active ? "#fff" : theme.textMuted }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={clear}
        disabled={token == null}
        style={[styles.restore, { borderColor: theme.cardBorder, opacity: token == null ? 0.4 : 1 }]}
      >
        <Text style={[styles.restoreText, { color: theme.text }]}>
          שחרר — חזרה לנתונים האמיתיים
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radii.lg, borderWidth: 1, gap: 4 },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right" },
  hint: { fontFamily: fonts.body, fontSize: 13, paddingVertical: 6, textAlign: "right" },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: "right", marginTop: 10 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  chipNum: { fontFamily: fonts.bodyBold, fontSize: 14 },
  chipLabel: { fontFamily: fonts.body, fontSize: 12 },
  restore: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  restoreText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
});
