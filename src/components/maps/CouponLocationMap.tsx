import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { MapPressEvent, Marker, Region } from "react-native-maps";

export type CouponLocation = {
  latitude: number;
  longitude: number;
};

const ISRAEL_REGION: Region = {
  latitude: 31.8,
  longitude: 34.9,
  latitudeDelta: 2.8,
  longitudeDelta: 2.8,
};

type CouponLocationMapProps = {
  location?: CouponLocation | null;
  locations?: Array<CouponLocation & { title?: string; description?: string }>;
  onLocationChange?: (location: CouponLocation) => void;
  editable?: boolean;
  height?: number;
};

export function CouponLocationMap({
  location,
  locations,
  onLocationChange,
  editable = false,
  height = 220,
}: CouponLocationMapProps) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.webFallback, { height }]}>
        <Text style={styles.webFallbackText}>
          תצוגת מפה זמינה באפליקציית Android וב־iPhone
        </Text>
      </View>
    );
  }

  const mapLocations = locations?.length ? locations : location ? [{ ...location }] : [];
  const firstLocation = mapLocations[0];
  const initialRegion = firstLocation
    ? {
        latitude: firstLocation.latitude,
        longitude: firstLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : ISRAEL_REGION;

  const handlePress = (event: MapPressEvent) => {
    if (!editable || !onLocationChange) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onLocationChange({ latitude, longitude });
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onPress={handlePress}
        showsUserLocation={false}
        showsCompass
      >
        {mapLocations.map((item, index) => (
          <Marker
            key={`${item.latitude}-${item.longitude}-${index}`}
            coordinate={item}
            draggable={editable && index === 0}
            onDragEnd={(event) => {
              if (!editable || !onLocationChange || index !== 0) return;
              onLocationChange(event.nativeEvent.coordinate);
            }}
            title={item.title || "מיקום השימוש"}
            description={item.description}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 16,
  },
  webFallback: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#e9eef3",
    paddingHorizontal: 20,
  },
  webFallbackText: {
    color: "#52606d",
    fontSize: 13,
    textAlign: "center",
  },
});
