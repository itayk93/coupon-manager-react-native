import { useNativeDriver } from "@/lib/animation";
import React, { useEffect, useRef } from "react";
import { Linking, Platform, StyleSheet, Text } from "react-native";
import { Animated, Easing } from "react-native";
import MapView, { MapPressEvent, Marker } from "react-native-maps";
import { groupByPoint, ISRAEL_REGION, regionForPoints } from "@/lib/mapMarkers";

export type CouponLocation = {
  latitude: number;
  longitude: number;
};

type CouponLocationMapProps = {
  location?: CouponLocation | null;
  locations?: Array<CouponLocation & { title?: string; description?: string; id?: string }>;
  onLocationPress?: (location: CouponLocation & { title?: string; description?: string; id?: string }) => void;
  onLocationChange?: (location: CouponLocation) => void;
  editable?: boolean;
  height?: number;
};

export function CouponLocationMap({
  location,
  locations,
  onLocationPress,
  onLocationChange,
  editable = false,
  height = 220,
}: CouponLocationMapProps) {
  const mapRef = useRef<MapView>(null);
  const reveal = useRef(new Animated.Value(1)).current;
  const locationKey = location ? `${location.latitude},${location.longitude}` : "empty";
  const mapLocations = locations?.length ? locations : location ? [{ ...location }] : [];
  const markers = groupByPoint(mapLocations);
  const initialRegion = regionForPoints(markers);
  const markersKey = markers.map((item) => `${item.latitude},${item.longitude}`).join("|");

  useEffect(() => {
    if (!location) return;
    reveal.setValue(0.92);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
    if (Platform.OS !== "web") {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        700,
      );
    }
  }, [locationKey, reveal, location]);

  // A usage reported while the screen is open adds a pin. Without this the map
  // keeps the frame it opened with and the new one can land off-screen.
  useEffect(() => {
    if (Platform.OS === "web" || location || !markersKey) return;
    mapRef.current?.animateToRegion(regionForPoints(markers), 500);
    // `markers` is rebuilt every render; its identity is not the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, location]);

  if (Platform.OS === "web") {
    const firstWebLocation = markers[0];
    const latitude = firstWebLocation?.latitude ?? ISRAEL_REGION.latitude;
    const longitude = firstWebLocation?.longitude ?? ISRAEL_REGION.longitude;
    const zoom = firstWebLocation ? 16 : 8;
    const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=${zoom}&output=embed`;
    const navigationUrl = firstWebLocation
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
      : null;
    return (
      <Animated.View style={[styles.container, { height, opacity: reveal, transform: [{ scale: reveal }] }]}>
        {React.createElement("iframe", {
          title: "מפת מיקום שימוש בקופון",
          src: mapUrl,
          style: styles.webMap,
          loading: "lazy",
          referrerPolicy: "no-referrer-when-downgrade",
        })}
        {editable && onLocationChange ? (
          <Text style={styles.webHint}>
            לבחירת נקודה מדויקת בדפדפן, השתמש בכפתור המיקום הנוכחי או הזן כתובת.
          </Text>
        ) : null}
        {navigationUrl ? (
          <Text
            accessibilityRole="link"
            onPress={() => void Linking.openURL(navigationUrl)}
            style={styles.navigationLink}
          >
            פתיחה לניווט ב־Google Maps
          </Text>
        ) : null}
      </Animated.View>
    );
  }


  const handlePress = (event: MapPressEvent) => {
    if (!editable || !onLocationChange) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onLocationChange({ latitude, longitude });
  };

  return (
    <Animated.View style={[styles.container, { height, opacity: reveal, transform: [{ scale: reveal }] }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onPress={handlePress}
        showsUserLocation={false}
        showsCompass
      >
        {markers.map((item, index) => (
          <Marker
            key={item.id || `${item.latitude}-${item.longitude}-${index}`}
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            draggable={editable && index === 0}
            onDragEnd={(event) => {
              if (!editable || !onLocationChange || index !== 0) return;
              onLocationChange(event.nativeEvent.coordinate);
            }}
            title={item.title || "מיקום השימוש"}
            description={
              item.visits > 1
                ? `${item.visits} שימושים${item.description ? ` · ${item.description}` : ""}`
                : item.description
            }
            onPress={() => onLocationPress?.(item)}
          />
        ))}
      </MapView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 16,
  },
  webMap: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
  webHint: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    color: "#52606d",
    fontSize: 13,
    textAlign: "center",
  },
  navigationLink: {
    color: "#1769d1",
    fontSize: 13,
    fontWeight: "600",
    paddingTop: 8,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
