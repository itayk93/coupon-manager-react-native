import React, { useMemo, useState } from "react";
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MapPinned, Navigation, Search, Store, WalletCards } from "lucide-react-native";
import { CouponLocationMap } from "@/components/maps/CouponLocationMap";
import { useWhereBought, type BoughtPlace } from "@/hooks/useWhereBought";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";

export function WhereBoughtScreen() {
  const { theme } = useAppTheme();
  const { data: places = [], isLoading, isError, refetch } = useWhereBought();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BoughtPlace | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("he-IL");
    if (!needle) return places;
    return places.filter((place) => `${place.name} ${place.address || ""}`.toLocaleLowerCase("he-IL").includes(needle));
  }, [places, search]);
  const totalSpent = places.reduce((sum, place) => sum + place.total, 0);
  const totalVisits = places.reduce((sum, place) => sum + place.visits, 0);
  const mapLocations = filtered.map((place) => ({ ...place, title: place.name, description: place.address || undefined }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>המפה האישית שלך</Text>
            <Text style={[styles.title, { color: theme.text }]}>איפה קניתי</Text>
            <Text style={[styles.subtitle, { color: theme.textSubtle }]}>כל המקומות שבהם השתמשת בקופונים</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: theme.primaryTint }]}><MapPinned size={25} color={theme.primary} /></View>
        </View>

        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Store size={18} color={theme.primary} /><Text style={[styles.statValue, { color: theme.text }]}>{places.length}</Text><Text style={[styles.statLabel, { color: theme.textSubtle }]}>מקומות</Text></View>
          <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Navigation size={18} color={theme.success} /><Text style={[styles.statValue, { color: theme.text }]}>{totalVisits}</Text><Text style={[styles.statLabel, { color: theme.textSubtle }]}>ביקורים</Text></View>
          <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><WalletCards size={18} color={theme.warning} /><Text style={[styles.statValue, { color: theme.text }]}>{formatIls(totalSpent)}</Text><Text style={[styles.statLabel, { color: theme.textSubtle }]}>סך קניות</Text></View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Search size={19} color={theme.textSubtle} /><TextInput value={search} onChangeText={setSearch} placeholder="חיפוש מקום או עיר" placeholderTextColor={theme.textSubtle} style={[styles.searchInput, { color: theme.text }]} /></View>

        {isLoading ? <Text style={[styles.state, { color: theme.textSubtle }]}>טוען את המקומות שלך...</Text> : isError ? <TouchableOpacity onPress={() => void refetch()}><Text style={[styles.state, { color: theme.danger }]}>לא ניתן לטעון כרגע. לחיצה לניסיון נוסף</Text></TouchableOpacity> : places.length === 0 ? <Text style={[styles.state, { color: theme.textSubtle }]}>עדיין אין מקומות עם קואורדינטות</Text> : (
          <>
            <View style={styles.sectionTitleRow}><Text style={[styles.sectionTitle, { color: theme.text }]}>המפה שלי</Text><Text style={[styles.sectionHint, { color: theme.textSubtle }]}>{filtered.length} מקומות</Text></View>
            <CouponLocationMap location={selected || filtered[0] || null} locations={mapLocations} onLocationPress={(location) => setSelected(filtered.find((place) => place.id === location.id) || null)} height={330} />
            {selected ? <View style={[styles.selectedCard, { backgroundColor: theme.card, borderColor: theme.primary }]}><Text style={[styles.placeTitle, { color: theme.text }]}>{selected.name}</Text>{selected.address ? <Text style={[styles.address, { color: theme.textSubtle }]}>{selected.address}</Text> : null}<TouchableOpacity onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`)}><Text style={[styles.navigate, { color: theme.primary }]}>פתיחת ניווט</Text></TouchableOpacity></View> : null}
            <View style={styles.list}>{filtered.map((place) => <TouchableOpacity key={place.id} onPress={() => setSelected(place)} activeOpacity={0.75} style={[styles.placeCard, { backgroundColor: theme.card, borderColor: selected?.id === place.id ? theme.primary : theme.cardBorder }]}><View style={[styles.pin, { backgroundColor: theme.primaryTint }]}><MapPinned size={19} color={theme.primary} /></View><View style={styles.placeInfo}><Text style={[styles.placeTitle, { color: theme.text }]}>{place.name}</Text>{place.address ? <Text style={[styles.address, { color: theme.textSubtle }]} numberOfLines={1}>{place.address}</Text> : null}<Text style={[styles.meta, { color: theme.textSubtle }]}>{place.visits} שימושים · {formatIls(place.total)}</Text></View></TouchableOpacity>)}</View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 18, paddingBottom: 36, gap: 16 }, header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, eyebrow: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "right" }, title: { fontFamily: fonts.display, fontSize: 30, textAlign: "right", marginTop: 2 }, subtitle: { fontFamily: fonts.body, fontSize: 14, textAlign: "right", marginTop: 2 }, headerIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }, stats: { flexDirection: "row-reverse", gap: 8 }, stat: { flex: 1, minHeight: 86, borderWidth: 1, borderRadius: radii.lg, padding: 10, alignItems: "center", justifyContent: "center", gap: 3 }, statValue: { fontFamily: fonts.display, fontSize: 20 }, statLabel: { fontFamily: fonts.body, fontSize: 11 }, searchBox: { minHeight: 48, borderWidth: 1, borderRadius: radii.md, flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 14, gap: 8 }, searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, textAlign: "right" }, sectionTitleRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "baseline" }, sectionTitle: { fontFamily: fonts.display, fontSize: 21, textAlign: "right" }, sectionHint: { fontFamily: fonts.body, fontSize: 13 }, state: { textAlign: "center", fontFamily: fonts.body, fontSize: 15, paddingVertical: 40 }, list: { gap: 10 }, placeCard: { flexDirection: "row-reverse", alignItems: "center", borderWidth: 1, borderRadius: radii.lg, padding: 12, gap: 12 }, pin: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, placeInfo: { flex: 1, alignItems: "flex-end" }, placeTitle: { fontFamily: fonts.bodyBold, fontSize: 16, textAlign: "right" }, address: { fontFamily: fonts.body, fontSize: 13, textAlign: "right", marginTop: 2 }, meta: { fontFamily: fonts.body, fontSize: 12, textAlign: "right", marginTop: 5 }, selectedCard: { borderWidth: 1, borderRadius: radii.lg, padding: 14, alignItems: "flex-end" }, navigate: { fontFamily: fonts.bodyBold, marginTop: 8, textDecorationLine: "underline" },
});
