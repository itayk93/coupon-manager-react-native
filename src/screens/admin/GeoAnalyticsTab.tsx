import React, { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { GeoRange, GeoRow, useGeoAnalytics } from "@/hooks/useGeoAnalytics";

/**
 * Where the users are, by city and region. The location is derived from the
 * request IP by the enrich-ip-geo cron and stored on each activity row; this
 * screen never sees an IP. "לא ידוע" is every row whose IP could not be placed
 * (private network, or not yet resolved).
 */
const RANGES: GeoRange[] = [30, 90];

export function GeoAnalyticsTab() {
  const { theme } = useAppTheme();
  const [days, setDays] = useState<GeoRange>(30);
  const { data = [], isLoading, isError } = useGeoAnalytics(days);

  const maxUsers = data.reduce((m, r) => Math.max(m, r.users), 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const on = r === days;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setDays(r)}
              style={[styles.rangeBtn, { backgroundColor: on ? theme.primary : theme.surfaceAlt }]}
            >
              <Text style={[styles.rangeText, { color: on ? "#ffffff" : theme.textMuted }]}>
                {r} ימים
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={theme.primary} />
      ) : isError ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>שגיאה בטעינת הנתונים</Text>
      ) : data.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>אין נתונים בטווח</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r, i) => `${r.region}|${r.city}|${i}`}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={styles.headRow}>
              <Text style={[styles.headCell, styles.place, { color: theme.textMuted }]}>עיר · אזור</Text>
              <Text style={[styles.headCell, styles.num, { color: theme.textMuted }]}>משתמשים</Text>
              <Text style={[styles.headCell, styles.num, { color: theme.textMuted }]}>אירועים</Text>
            </View>
          }
          renderItem={({ item }: { item: GeoRow }) => (
            <View style={[styles.row, { borderColor: theme.border }]}>
              <View style={styles.place}>
                <View
                  style={[
                    styles.bar,
                    { width: `${Math.round((item.users / maxUsers) * 100)}%`, backgroundColor: theme.primary + "22" },
                  ]}
                />
                <Text style={[styles.city, { color: theme.text }]} numberOfLines={1}>
                  {item.city}
                </Text>
                <Text style={[styles.region, { color: theme.textMuted }]} numberOfLines={1}>
                  {item.region}
                </Text>
              </View>
              <Text style={[styles.num, styles.value, { color: theme.text }]}>{item.users}</Text>
              <Text style={[styles.num, styles.value, { color: theme.textMuted }]}>{item.events}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  rangeRow: { flexDirection: "row-reverse", gap: 6, marginBottom: 12 },
  rangeBtn: { paddingHorizontal: 16, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rangeText: { fontSize: 13, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 32, fontSize: 14 },
  headRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 6 },
  headCell: { fontSize: 11, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 6,
    overflow: "hidden",
  },
  place: { flex: 1, alignItems: "flex-end" },
  bar: { position: "absolute", right: 0, top: 0, bottom: 0, borderRadius: radii.md },
  city: { fontSize: 15, fontWeight: "700", fontFamily: fonts.display },
  region: { fontSize: 12, marginTop: 2 },
  num: { width: 72, textAlign: "center" },
  value: { fontSize: 15, fontWeight: "700" },
});
