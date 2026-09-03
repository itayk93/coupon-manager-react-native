import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, MapPin } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CouponLocationMap } from "@/components/maps/CouponLocationMap";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useWhereBought } from "@/hooks/useWhereBought";
import { filterPlacesWithinRadius, type GeoPoint } from "@/lib/geoDistance";
import { supabase } from "@/integrations/supabase/client";

/** Fixed on purpose — a slider here is noise. Two-ish neighbourhoods across. */
const RADIUS_KM = 3;

export type PickedPlace = {
  placeName: string;
  placeAddress: string;
  latitude: number;
  longitude: number;
};

type PlacePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (place: PickedPlace) => void;
};

/**
 * "Pick from places I've been to." Type an area, the map centres there and
 * shows only the user's own past usage locations within {@link RADIUS_KM}.
 * Tapping one hands its stored name + address + coordinates back to the usage
 * form — nothing here writes to the server.
 */
export function PlacePickerModal({ visible, onClose, onPick }: PlacePickerModalProps) {
  const { theme } = useAppTheme();
  const { data: places = [], isLoading } = useWhereBought();

  const [area, setArea] = useState("");
  const [center, setCenter] = useState<GeoPoint | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resolvedArea = useRef("");

  useEffect(() => {
    if (visible) return;
    setArea("");
    setCenter(null);
    setIsSearching(false);
    setMessage("");
    setSelectedId(null);
    resolvedArea.current = "";
  }, [visible]);

  useEffect(() => {
    const query = area.trim();
    if (!visible || query.length < 3) {
      setMessage("");
      return;
    }
    if (resolvedArea.current === query) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setMessage("");
      const { data, error } = await supabase.functions.invoke("geocode-address", { body: { query } });
      if (cancelled) return;
      setIsSearching(false);
      const result = data?.result as { latitude: number | null; longitude: number | null } | undefined;
      if (error || !result || result.latitude === null || result.longitude === null) {
        setCenter(null);
        setMessage("לא הצלחתי לאתר את האזור הזה. נסה ניסוח אחר, למשל 'יהודה הלוי תל אביב'.");
        return;
      }
      resolvedArea.current = query;
      setCenter({ latitude: result.latitude, longitude: result.longitude });
      setSelectedId(null);
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [area, visible]);

  const nearby = useMemo(
    () => filterPlacesWithinRadius(places, center, RADIUS_KM),
    [places, center],
  );

  const mapLocations = useMemo(
    () =>
      nearby.map((place) => ({
        id: place.id,
        latitude: place.latitude,
        longitude: place.longitude,
        title: place.name,
        description: place.address || undefined,
      })),
    [nearby],
  );

  const selected = nearby.find((place) => place.id === selectedId) || null;

  const confirm = () => {
    if (!selected) return;
    onPick({
      placeName: selected.name,
      placeAddress: selected.address || "",
      latitude: selected.latitude,
      longitude: selected.longitude,
    });
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="מקומות שהייתי בהם" subtitle="הקלד אזור ובחר מקום מהעבר">
      <View style={styles.container}>
        <Input
          label="אזור"
          placeholder="למשל: יהודה הלוי תל אביב"
          value={area}
          onChangeText={(value) => {
            setArea(value);
            resolvedArea.current = "";
          }}
        />
        {isSearching || message ? (
          <Text style={[styles.message, { color: theme.textMuted }]}>
            {isSearching ? "מחפש את האזור..." : message}
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={theme.primary} style={styles.loader} />
        ) : !center ? (
          <EmptyState
            icon={<MapPin size={22} color={theme.primary} />}
            title="הקלד אזור"
            subtitle="נציג את המקומות שכבר סימנת בהם שימוש ברדיוס של 3 ק״מ סביב האזור."
          />
        ) : nearby.length === 0 ? (
          <EmptyState
            icon={<MapPin size={22} color={theme.primary} />}
            title="אין מקומות באזור הזה"
            subtitle="לא נמצא מקום מההיסטוריה שלך ברדיוס של 3 ק״מ. נסה אזור אחר."
          />
        ) : (
          <>
            <CouponLocationMap
              locations={mapLocations}
              onLocationPress={(location) => setSelectedId(location.id || null)}
              height={200}
            />
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {nearby.map((place) => {
                const isSelected = place.id === selectedId;
                return (
                  <TouchableOpacity
                    key={place.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedId(place.id)}
                    style={[
                      styles.row,
                      { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: theme.surfaceAlt },
                    ]}
                  >
                    {isSelected ? <Check size={16} color={theme.primary} /> : <View style={{ width: 16 }} />}
                    <View style={styles.rowText}>
                      <Text numberOfLines={1} style={[styles.rowName, { color: theme.text }]}>{place.name}</Text>
                      {place.address ? (
                        <Text numberOfLines={1} style={[styles.rowSub, { color: theme.textMuted }]}>{place.address}</Text>
                      ) : null}
                      <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                        {place.visits > 1 ? `${place.visits} ביקורים · ` : ""}
                        {place.distanceKm.toFixed(1)} ק״מ מהמרכז
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Button
              title={selected ? `סמן: ${selected.name}` : "בחר מקום מהרשימה"}
              onPress={confirm}
              disabled={!selected}
              icon={<MapPin size={18} color="#fff" />}
              style={styles.confirm}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4, gap: 4 },
  message: { fontSize: 12, marginTop: -4, marginBottom: 8, textAlign: "right" },
  loader: { marginVertical: 24 },
  list: { maxHeight: 240, marginTop: 12 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowText: { flex: 1, alignItems: "flex-end" },
  rowName: { fontSize: 14, fontWeight: "700", textAlign: "right" },
  rowSub: { fontSize: 12, marginTop: 2, textAlign: "right" },
  confirm: { marginTop: 4 },
});
