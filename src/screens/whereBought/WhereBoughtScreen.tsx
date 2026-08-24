import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowRight, Crosshair, Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useWhereBought, type BoughtPlace } from "@/hooks/useWhereBought";

/* A straight port of the "איפה אכלתי" page from budget-lens-new: one blue spend
   ramp on the map, a draggable panel on top of it, and the same sections in the
   same order. Colours and type sizes are the web page's, not the app theme's —
   the ask was for the two screens to look identical. */

const BUCKETS = [
  { min: 0, color: "#a8c7f0", label: "< ₪90" },
  { min: 90, color: "#7aa9e8", label: "₪90+" },
  { min: 270, color: "#4285f4", label: "₪270+" },
  { min: 650, color: "#1a56c4", label: "₪650+" },
  { min: 1100, color: "#0b3d91", label: "₪1,100+" },
];

const HOME: Region = { latitude: 32.07, longitude: 34.78, latitudeDelta: 1.6, longitudeDelta: 1.6 };
const PAGE_SIZE = 5;
const SCREEN = Dimensions.get("window");
/* The web page's three stops: a peek, a working height, and near-full. */
const SHEET_STOPS = [
  Math.max(132, Math.round(SCREEN.height * 0.22)),
  Math.round(SCREEN.height * 0.56),
  Math.round(SCREEN.height * 0.9),
];
const SHEET_RATIO_KEY = "where-bought-sheet-ratio";
const CORRECTIONS_KEY = "where-bought-corrections";
const SWIPE_MIN = 48;

const money = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const monthOf = (iso: string) => (iso || "").slice(0, 7);
const dateLabel = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
/* Weak-directional lines like "₪498 · 2×" flip inside RTL context; a leading LRM pins them. */
const ltr = (s: string) => `‎${s}`;

/* On web react-native-maps is a View shim (src/web/react-native-maps.js): it
   accepts a ref but has none of the imperative methods. Calling one there threw
   and took the whole screen down, so every call goes through this guard. */
function callMap<K extends keyof MapView>(map: MapView | null, method: K, ...args: any[]) {
  const fn = map?.[method] as unknown;
  if (typeof fn !== "function") return;
  (fn as (...rest: any[]) => void).apply(map, args);
}

function bucketColor(total: number) {
  let color = BUCKETS[0].color;
  for (const bucket of BUCKETS) if (total >= bucket.min) color = bucket.color;
  return color;
}

/** Spend drives dot area, so a ₪3,000 place doesn't swallow the screen. */
function dotSize(total: number) {
  return Math.max(14, Math.min(44, 14 + Math.sqrt(total) * 0.9));
}

function cityOf(place: BoughtPlace) {
  const parts = (place.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "ללא כתובת";
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

type Derived = BoughtPlace & { city: string; first: string; last: string };

function derive(place: BoughtPlace): Derived {
  const dates = place.transactions.map((txn) => txn.date || "").filter(Boolean).sort();
  return { ...place, city: cityOf(place), first: dates[0] || "", last: dates[dates.length - 1] || "" };
}

function monthlySpend(place: Derived) {
  const byMonth = new Map<string, number>();
  for (const txn of place.transactions) {
    const month = monthOf(txn.date || "");
    if (!month) continue;
    byMonth.set(month, (byMonth.get(month) || 0) + txn.amount);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/* Same deal as the web page: a page of five rows, swiped sideways. The web
   version reads raw touch deltas; here a PanResponder claims the gesture only
   once it is clearly horizontal, so the sheet's vertical scroll still wins. */
function useSwipePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageRef = useRef(0);
  const totalRef = useRef(totalPages);
  pageRef.current = page;
  totalRef.current = totalPages;

  useEffect(() => { setPage(0); }, [items]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dx) < SWIPE_MIN || Math.abs(gesture.dx) <= Math.abs(gesture.dy) * 1.2) return;
        // Same direction as the web page: swiping left steps back a page.
        const next = gesture.dx < 0 ? pageRef.current - 1 : pageRef.current + 1;
        const clamped = Math.max(0, Math.min(totalRef.current - 1, next));
        if (clamped === pageRef.current) return;
        setPage(clamped);
        void Haptics.selectionAsync();
      },
    }),
  ).current;

  return {
    page,
    totalPages,
    setPage,
    items: items.slice(page * pageSize, (page + 1) * pageSize),
    panHandlers: responder.panHandlers,
  };
}

function PaginationDots({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <View style={S.pagination}>
      {Array.from({ length: totalPages }, (_, index) => (
        <TouchableOpacity
          key={index}
          accessibilityRole="button"
          accessibilityLabel={`עמוד ${index + 1} מתוך ${totalPages}`}
          onPress={() => onChange(index)}
          style={[S.paginationDot, page === index && S.paginationDotActive]}
        />
      ))}
    </View>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <View style={S.bigCell}>
      <Text style={S.bigValue} numberOfLines={1}>{value}</Text>
      <Text style={S.bigLabel}>{label}</Text>
    </View>
  );
}

function Small({ value, label }: { value: string; label: string }) {
  return (
    <View style={S.smallCell}>
      <Text style={S.smallValue} numberOfLines={1}>{value}</Text>
      <Text style={S.smallLabel}>{label}</Text>
    </View>
  );
}

export function WhereBoughtScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(HOME);
  const { data: rawPlaces = [], isLoading, isError, error } = useWhereBought();

  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"all" | "year">("all");
  const [returningOnly, setReturningOnly] = useState(false);
  const [highSpendOnly, setHighSpendOnly] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [tab, setTab] = useState<"spots" | "heat">("spots");
  const [selected, setSelected] = useState<Derived | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);
  const [viewportKeys, setViewportKeys] = useState<string[] | null>(null);
  const [searchAreaVisible, setSearchAreaVisible] = useState(false);
  const [areaFeedback, setAreaFeedback] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [corrections, setCorrections] = useState<Record<string, Partial<BoughtPlace>>>({});

  const scrollRef = useRef<ScrollView>(null);
  const resultsOffset = useRef(0);
  const previousRegion = useRef<Region | null>(null);

  const sheetHeight = useRef(new Animated.Value(SHEET_STOPS[1])).current;
  const sheetHeightValue = useRef(SHEET_STOPS[1]);
  const [isPeek, setIsPeek] = useState(false);
  const didDragSheet = useRef(false);

  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      sheetHeightValue.current = value;
      setIsPeek(value <= SHEET_STOPS[0] + 12);
    });
    return () => sheetHeight.removeListener(id);
  }, [sheetHeight]);

  /* The last height the user chose is remembered between visits, the way the
     web page keeps it in localStorage. */
  useEffect(() => {
    void (async () => {
      const [ratio, saved] = await Promise.all([
        AsyncStorage.getItem(SHEET_RATIO_KEY),
        AsyncStorage.getItem(CORRECTIONS_KEY),
      ]);
      if (ratio) {
        const height = Math.max(SHEET_STOPS[0], Math.min(SHEET_STOPS[2], Math.round(SCREEN.height * Number(ratio))));
        sheetHeight.setValue(height);
      }
      if (saved) {
        try { setCorrections(JSON.parse(saved) as Record<string, Partial<BoughtPlace>>); } catch { /* ignore bad cache */ }
      }
    })();
  }, [sheetHeight]);

  const setSheetStop = (stop: number) => {
    void AsyncStorage.setItem(SHEET_RATIO_KEY, String(stop / SCREEN.height));
    void Haptics.selectionAsync();
    Animated.spring(sheetHeight, { toValue: stop, useNativeDriver: false, bounciness: 2 }).start();
  };

  const collapseSheet = () => setSheetStop(SHEET_STOPS[0]);

  const expandPeekSheet = () => {
    if (sheetHeightValue.current <= SHEET_STOPS[0] + 12) setSheetStop(SHEET_STOPS[1]);
  };

  const cycleSheetHeight = () => {
    if (didDragSheet.current) {
      didDragSheet.current = false;
      return;
    }
    const currentIndex = SHEET_STOPS.reduce((best, stop, index) =>
      Math.abs(stop - sheetHeightValue.current) < Math.abs(SHEET_STOPS[best] - sheetHeightValue.current) ? index : best, 0);
    setSheetStop(SHEET_STOPS[(currentIndex + 1) % SHEET_STOPS.length]);
  };

  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => { didDragSheet.current = false; },
      onPanResponderMove: (_event, gesture) => {
        if (Math.abs(gesture.dy) > 4) didDragSheet.current = true;
        const next = Math.min(SHEET_STOPS[2], Math.max(SHEET_STOPS[0], sheetHeightValue.current - gesture.dy));
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (!didDragSheet.current && Math.abs(gesture.dy) <= 4) {
          // A tap on the grabber cycles peek → working → full, as on the web.
          cycleSheetHeight();
          return;
        }
        const target = SHEET_STOPS.reduce((best, stop) =>
          Math.abs(stop - sheetHeightValue.current) < Math.abs(best - sheetHeightValue.current) ? stop : best);
        setSheetStop(target);
        didDragSheet.current = false;
      },
    }),
  ).current;

  /* While the sheet is peeking its list does not scroll; a swipe up on the body
     opens it instead — the web page's onPanelTouchMove/onPanelWheel pair. */
  const peekPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        sheetHeightValue.current <= SHEET_STOPS[0] + 12 && gesture.dy < -16,
      onPanResponderRelease: () => expandPeekSheet(),
    }),
  ).current;

  const places = useMemo(
    () => rawPlaces.map((place) => derive({ ...place, ...(corrections[place.id] || {}) })),
    [rawPlaces, corrections],
  );

  const filteredBeforeViewport = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("he-IL");
    const newest = places.map((place) => place.last).filter(Boolean).sort().pop() || "";
    const cutoff = newest ? `${Number(newest.slice(0, 4)) - 1}-${newest.slice(5, 7)}` : "";
    return places.filter((place) => {
      if (needle && ![place.name, place.address || "", place.city].some((value) => value.toLocaleLowerCase("he-IL").includes(needle))) return false;
      if (period === "year" && place.last < cutoff) return false;
      if (returningOnly && place.visits < 2) return false;
      if (highSpendOnly && place.total < 500) return false;
      if (cityFilter && place.city !== cityFilter) return false;
      return true;
    });
  }, [places, query, period, returningOnly, highSpendOnly, cityFilter]);

  const visible = useMemo(() => {
    if (!viewportKeys) return filteredBeforeViewport;
    const keys = new Set(viewportKeys);
    return filteredBeforeViewport.filter((place) => keys.has(place.id));
  }, [filteredBeforeViewport, viewportKeys]);

  const stats = useMemo(() => {
    const total = visible.reduce((sum, place) => sum + place.total, 0);
    const visits = visible.reduce((sum, place) => sum + place.visits, 0);
    const cities = new Set(visible.map((place) => place.city).filter(Boolean));
    const months = visible.flatMap((place) => [monthOf(place.first), monthOf(place.last)]).filter(Boolean).sort();
    return { total, visits, spots: visible.length, cities: cities.size, from: months[0] || "", to: months[months.length - 1] || "" };
  }, [visible]);

  const cityRows = useMemo(() => {
    const by = new Map<string, { city: string; total: number; spots: number; visits: number }>();
    for (const place of visible) {
      const key = place.city || "—";
      const row = by.get(key) || { city: key, total: 0, spots: 0, visits: 0 };
      row.total += place.total;
      row.spots += 1;
      row.visits += place.visits;
      by.set(key, row);
    }
    return [...by.values()].sort((a, b) => b.total - a.total);
  }, [visible]);

  const maxCityTotal = Math.max(1, ...cityRows.map((row) => row.total));
  const topSpots = useMemo(() => [...visible].sort((a, b) => b.total - a.total), [visible]);
  const cityPager = useSwipePagination(cityRows);
  const spotPager = useSwipePagination(topSpots);

  const insights = useMemo(() => {
    if (!visible.length) return null;
    const mostVisited = [...visible].sort((a, b) => b.visits - a.visits)[0];
    const largest = visible
      .flatMap((place) => place.transactions.map((txn) => ({ ...txn, place: place.name })))
      .sort((a, b) => b.amount - a.amount)[0];
    const months = new Set(visible.flatMap((place) => place.transactions.map((txn) => monthOf(txn.date || "")).filter(Boolean)));
    const newest = visible.map((place) => place.last).filter(Boolean).sort().pop() || "";
    const dormantCutoff = newest ? `${Number(newest.slice(0, 4)) - 1}-${newest.slice(5, 7)}` : "";
    return {
      topCity: cityRows[0],
      mostVisited,
      largest,
      monthlyAverage: months.size ? stats.total / months.size : 0,
      averageVisit: stats.visits ? stats.total / stats.visits : 0,
      dormant: dormantCutoff ? visible.filter((place) => place.last && place.last < dormantCutoff).length : 0,
    };
  }, [visible, cityRows, stats.total, stats.visits]);

  const focusPlace = (place: Derived) => {
    setSelected(place);
    setDrillOpen(false);
    setCorrectionOpen(false);
    setSheetStop(SHEET_STOPS[1]);
    callMap(mapRef.current, "animateToRegion",
      { latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      600,
    );
  };

  const fitTo = (list: Derived[], maxSpan = 0) => {
    if (!list.length) return;
    if (list.length === 1 || maxSpan) {
      const span = maxSpan || 0.02;
      callMap(mapRef.current, "animateToRegion", {
        latitude: list.reduce((sum, place) => sum + place.latitude, 0) / list.length,
        longitude: list.reduce((sum, place) => sum + place.longitude, 0) / list.length,
        latitudeDelta: Math.max(span, (Math.max(...list.map((p) => p.latitude)) - Math.min(...list.map((p) => p.latitude))) * 1.6),
        longitudeDelta: Math.max(span, (Math.max(...list.map((p) => p.longitude)) - Math.min(...list.map((p) => p.longitude))) * 1.6),
      }, 800);
      return;
    }
    callMap(mapRef.current, "fitToCoordinates",
      list.map((place) => ({ latitude: place.latitude, longitude: place.longitude })),
      {
        edgePadding: { top: 90, right: 40, bottom: Math.min(sheetHeightValue.current + 40, 460), left: 40 },
        animated: true,
      },
    );
  };

  const focusCity = (city: string) => {
    const cityPlaces = visible.filter((place) => place.city === city);
    if (!cityPlaces.length) return;
    // Remember where the map was so "חזרה לכל הערים" can put it back.
    if (!cityFilter) previousRegion.current = regionRef.current;
    setCityFilter(city);
    setSelected(null);
    fitTo(cityPlaces, cityPlaces.length === 1 ? 0.02 : 0);
  };

  const clearCityFocus = () => {
    setCityFilter(null);
    setSelected(null);
    const previous = previousRegion.current;
    previousRegion.current = null;
    callMap(mapRef.current, "animateToRegion", previous || HOME, 700);
  };

  const applySearchArea = () => {
    const region = regionRef.current;
    const inView = filteredBeforeViewport.filter((place) =>
      Math.abs(place.latitude - region.latitude) <= region.latitudeDelta / 2 &&
      Math.abs(place.longitude - region.longitude) <= region.longitudeDelta / 2);
    setViewportKeys(inView.map((place) => place.id));
    setCityFilter(null);
    previousRegion.current = null;
    setSelected(null);
    setSearchAreaVisible(false);
    setAreaFeedback(inView.length ? `נמצאו ${inView.length} מקומות באזור` : "לא נמצאו מקומות באזור הזה");
    setSheetStop(SHEET_STOPS[1]);
  };

  const clearViewportFilter = () => {
    setViewportKeys(null);
    setSearchAreaVisible(false);
    setAreaFeedback(null);
  };

  /* Tapping the "נמצאו N מקומות" pill opens the sheet on the results list. */
  const showAreaResults = () => {
    if (!viewportKeys?.length) return;
    setAreaFeedback(null);
    setTab("spots");
    setSheetStop(SHEET_STOPS[2]);
    setTimeout(() => scrollRef.current?.scrollTo({ y: resultsOffset.current, animated: true }), 240);
  };

  const openCorrection = (place: Derived) => {
    setCorrectionOpen(true);
    setEditName(place.name);
    setEditCity(place.city);
    setEditLat(String(place.latitude));
    setEditLng(String(place.longitude));
  };

  const saveCorrection = () => {
    if (!selected) return;
    const patch: Partial<BoughtPlace> = {
      name: editName.trim() || selected.name,
      address: editCity.trim() ? [editCity.trim()].join(", ") : selected.address,
      latitude: Number(editLat) || selected.latitude,
      longitude: Number(editLng) || selected.longitude,
    };
    const next = { ...corrections, [selected.id]: patch };
    setCorrections(next);
    void AsyncStorage.setItem(CORRECTIONS_KEY, JSON.stringify(next));
    setSelected(derive({ ...selected, ...patch }));
    setCorrectionOpen(false);
  };

  const locateMe = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("אין הרשאת מיקום");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocationError(null);
      callMap(mapRef.current, "animateToRegion", {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }, 700);
    } catch {
      setLocationError("לא הצלחתי לאתר מיקום");
    }
  };

  useEffect(() => {
    if (places.length && !viewportKeys && !cityFilter) fitTo(places);
    // Only on the first load of the data set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.length]);

  const showLabels = regionRef.current.latitudeDelta < 0.08;

  /* The web build has no real map (the shim above), so it gets the same Google
     embed the coupon detail screen uses. Everything else on the page is shared. */
  const webCenter = selected || visible[0] || places[0] || null;

  return (
    <View style={S.shell}>
      {Platform.OS === "web" ? (
        React.createElement("iframe", {
          title: "מפת המקומות",
          src: `https://www.google.com/maps?q=${webCenter?.latitude ?? HOME.latitude},${webCenter?.longitude ?? HOME.longitude}&z=${webCenter ? 14 : 8}&output=embed`,
          style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 },
          loading: "lazy",
        })
      ) : (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={HOME}
        showsCompass={false}
        onRegionChangeComplete={(region) => {
          regionRef.current = region;
          setSearchAreaVisible(true);
        }}
        onPress={() => { setSelected(null); setDrillOpen(false); collapseSheet(); }}
      >
        {tab === "heat"
          ? visible.map((place) => (
            <Circle
              key={place.id}
              center={{ latitude: place.latitude, longitude: place.longitude }}
              radius={Math.max(220, Math.sqrt(place.total) * 42)}
              strokeColor="rgba(0,0,0,0)"
              fillColor={`${bucketColor(place.total)}55`}
            />
          ))
          : visible.map((place) => {
            const size = dotSize(place.total);
            const active = selected?.id === place.id;
            return (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                onPress={() => focusPlace(place)}
                tracksViewChanges={Platform.OS === "android" ? false : undefined}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={S.markerWrap}>
                  <View
                    style={[
                      S.marker,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: bucketColor(place.total),
                        borderWidth: active ? 2.5 : 1,
                      },
                    ]}
                  />
                  {showLabels ? (
                    <Text style={S.markerLabel} numberOfLines={2}>
                      {`${place.name}\n${ltr(`${money(place.total)} · ${place.visits}×`)}`}
                    </Text>
                  ) : null}
                </View>
              </Marker>
            );
          })}
      </MapView>
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="חזרה לאפליקציה"
        style={[S.appBack, { top: Math.max(insets.top, 12) }]}
      >
        <ArrowRight size={23} strokeWidth={2.4} color="#1f2430" />
      </TouchableOpacity>

      {searchAreaVisible ? (
        <TouchableOpacity onPress={applySearchArea} style={[S.searchAreaBtn, { top: Math.max(insets.top, 12) + 60 }]}>
          <Search size={17} strokeWidth={2.3} color="#1a56c4" />
          <Text style={S.searchAreaText}>{viewportKeys ? "עדכן את האזור הזה" : "חפש באזור הזה"}</Text>
        </TouchableOpacity>
      ) : null}

      {areaFeedback ? (
        <TouchableOpacity
          onPress={showAreaResults}
          disabled={!viewportKeys?.length}
          style={[S.areaFeedback, { top: Math.max(insets.top, 12) + 110 }]}
        >
          <Text style={S.areaFeedbackText}>{areaFeedback}</Text>
        </TouchableOpacity>
      ) : null}

      {locationError ? (
        <View style={[S.locationError, { top: Math.max(insets.top, 12) + 60 }]}>
          <Text style={S.locationErrorText}>{locationError}</Text>
        </View>
      ) : null}

      <Animated.View style={[S.controlDock, { bottom: Animated.add(sheetHeight, new Animated.Value(14)) }]}>
        <TouchableOpacity onPress={locateMe} style={S.controlButton} accessibilityLabel="המיקום שלי">
          <Crosshair size={23} strokeWidth={2.1} color="#1a56c4" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[S.panel, { height: sheetHeight }]}>
        <View style={S.sheetHandle} {...sheetPan.panHandlers}>
          <View style={S.sheetHandleBar} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={S.panelScroll}
          contentContainerStyle={S.panelContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isPeek}
          {...(isPeek ? peekPan.panHandlers : {})}
        >
          <View style={S.head}>
            {cityFilter ? (
              <TouchableOpacity onPress={clearCityFocus} style={S.cityBack}>
                <Text style={S.cityBackText}>← חזרה לכל הערים</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={S.title}>{cityFilter ? cityFilter : "איפה קניתי 🌎"}</Text>

            {!isLoading && !isError ? (
              <>
                <Text style={S.subtitle}>
                  {stats.spots.toLocaleString("he-IL")} מקומות · {stats.cities} ערים · היסטוריית קופונים {stats.from} ← {stats.to}
                </Text>
                <View style={S.bigStats}>
                  <Big value={money(stats.total)} label="סה״כ הוצאה" />
                  <Big value={stats.visits.toLocaleString("he-IL")} label="שימושים" />
                  <Big value={stats.spots.toLocaleString("he-IL")} label="מקומות" />
                </View>
              </>
            ) : null}

            <View style={S.tabs}>
              {([["spots", "מקומות"], ["heat", "מפת חום"]] as const).map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setTab(key)} style={[S.tab, tab === key && S.tabOn]}>
                  <Text style={[S.tabText, tab === key && S.tabTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setLegendOpen((open) => !open)} style={S.legendToggle}>
              <Text style={S.legendToggleText}>{legendOpen ? "הסתר מקרא" : "איך קוראים את המפה? ⓘ"}</Text>
            </TouchableOpacity>
            {legendOpen ? (
              <View style={S.legend}>
                <Text style={S.legendCap}>סה״כ הוצאה לכל מקום</Text>
                <View style={S.legendRow}>
                  {BUCKETS.map((bucket) => (
                    <View key={bucket.label} style={S.legendCell}>
                      <View style={[S.legendSwatch, { backgroundColor: bucket.color }]} />
                      <Text style={S.legendLabel}>{bucket.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={S.legendNote}>גודל העיגול גדל עם ההוצאה</Text>
              </View>
            ) : null}

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="חפש מקום או עיר"
              placeholderTextColor="#9aa1ac"
              style={S.search}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterChips}>
              <TouchableOpacity onPress={() => setPeriod((value) => (value === "all" ? "year" : "all"))} style={[S.filterChip, period === "year" && S.filterChipOn]}>
                <Text style={[S.filterChipText, period === "year" && S.filterChipTextOn]}>השנה האחרונה</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReturningOnly((value) => !value)} style={[S.filterChip, returningOnly && S.filterChipOn]}>
                <Text style={[S.filterChipText, returningOnly && S.filterChipTextOn]}>חזרתי שוב</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHighSpendOnly((value) => !value)} style={[S.filterChip, highSpendOnly && S.filterChipOn]}>
                <Text style={[S.filterChipText, highSpendOnly && S.filterChipTextOn]}>מעל ₪500</Text>
              </TouchableOpacity>
              {cityFilter ? (
                <TouchableOpacity onPress={clearCityFocus} style={[S.filterChip, S.filterChipOn]}>
                  <Text style={[S.filterChipText, S.filterChipTextOn]}>{cityFilter} ×</Text>
                </TouchableOpacity>
              ) : null}
              {viewportKeys ? (
                <TouchableOpacity onPress={clearViewportFilter} style={[S.filterChip, S.filterChipOn]}>
                  <Text style={[S.filterChipText, S.filterChipTextOn]}>אזור המפה · {visible.length} ×</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>

          {isError ? (
            <Text style={S.error}>שגיאה בטעינת הנתונים: <Text style={S.errorDetail}>{ltr((error as Error)?.message || "")}</Text></Text>
          ) : null}

          {isLoading ? (
            <View style={S.skeletonWrap}>
              {[1, 2, 3, 4].map((item) => <View key={item} style={S.skeletonRow} />)}
            </View>
          ) : null}

          {!isLoading && !isError && places.length === 0 ? (
            <View style={S.empty}>
              <Text style={S.emptyTitle}>עוד אין מקומות להציג</Text>
              <Text style={S.emptyBody}>המפה נבנית מהשימושים שלך בקופונים. אחרי השימוש הבא עם מיקום, המקום יופיע כאן.</Text>
            </View>
          ) : null}

          {insights && !viewportKeys ? (
            <>
              <Text style={S.sectionCap}>מה גיליתי?</Text>
              <View style={S.insightGrid}>
                <View style={S.insightCard}><Text style={S.insightValue} numberOfLines={1}>{insights.topCity?.city}</Text><Text style={S.insightLabel}>העיר המובילה · {money(insights.topCity?.total || 0)}</Text></View>
                <View style={S.insightCard}><Text style={S.insightValue} numberOfLines={1}>{insights.mostVisited.name}</Text><Text style={S.insightLabel}>חזרת {insights.mostVisited.visits} פעמים</Text></View>
                <View style={S.insightCard}><Text style={S.insightValue}>{money(insights.monthlyAverage)}</Text><Text style={S.insightLabel}>ממוצע חודשי</Text></View>
                <View style={S.insightCard}><Text style={S.insightValue} numberOfLines={1}>{insights.largest?.place || "—"}</Text><Text style={S.insightLabel}>השימוש הגדול · {money(insights.largest?.amount || 0)}</Text></View>
                <View style={S.insightCard}><Text style={S.insightValue}>{money(insights.averageVisit)}</Text><Text style={S.insightLabel}>ממוצע לשימוש</Text></View>
                <View style={S.insightCard}><Text style={S.insightValue}>{insights.dormant}</Text><Text style={S.insightLabel}>מקומות ישנים</Text></View>
              </View>
            </>
          ) : null}

          {!viewportKeys ? (
            <>
              <Text style={S.sectionCap}>ערים</Text>
              <View {...cityPager.panHandlers}>
                {cityPager.items.map((row) => (
                  <TouchableOpacity key={row.city} onPress={() => focusCity(row.city)} style={[S.cityRow, cityFilter === row.city && S.cityRowOn]}>
                    <View style={S.cityTop}>
                      <Text style={S.cityName} numberOfLines={1}>{row.city}</Text>
                      <Text style={S.cityMoney}>{money(row.total)}</Text>
                    </View>
                    <View style={S.barTrack}>
                      <View style={[S.barFill, { width: `${Math.max(2, (row.total / maxCityTotal) * 100)}%` }]} />
                    </View>
                    <Text style={S.cityMeta}>{row.spots} מקומות · {row.visits} שימושים</Text>
                  </TouchableOpacity>
                ))}
                <PaginationDots page={cityPager.page} totalPages={cityPager.totalPages} onChange={cityPager.setPage} />
              </View>
            </>
          ) : null}

          <Text style={S.sectionCap}>
            {viewportKeys ? `${visible.length} תוצאות באזור` : "המקומות המובילים"}
            <Text style={S.sectionCapDim}> · לפי סה״כ הוצאה</Text>
          </Text>
          <View
            onLayout={(event) => { resultsOffset.current = event.nativeEvent.layout.y; }}
            {...spotPager.panHandlers}
          >
            {spotPager.items.map((place, index) => (
              <TouchableOpacity key={place.id} onPress={() => focusPlace(place)} style={[S.spotRow, selected?.id === place.id && S.spotRowOn]}>
                <Text style={S.spotRank}>{spotPager.page * PAGE_SIZE + index + 1}</Text>
                <View style={S.spotMain}>
                  <Text style={S.spotName} numberOfLines={1}>{place.name}</Text>
                  <Text style={S.spotCity} numberOfLines={1}>{place.city}</Text>
                </View>
                <View style={S.spotRight}>
                  <Text style={S.spotMoney}>{money(place.total)}</Text>
                  <Text style={S.spotVisits}>{ltr(`${place.visits}×`)}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <PaginationDots page={spotPager.page} totalPages={spotPager.totalPages} onChange={spotPager.setPage} />
            {!isLoading && visible.length === 0 && places.length > 0 ? <Text style={S.loading}>אין תוצאות</Text> : null}
          </View>
        </ScrollView>

        {selected ? (
          <View style={S.detail}>
            <View style={S.detailHeader}>
              <TouchableOpacity onPress={() => { setSelected(null); setDrillOpen(false); }} style={S.detailBack}>
                <Text style={S.detailBackText}>← חזרה למפה</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSelected(null); setDrillOpen(false); }} style={S.detailClose}>
                <Text style={S.detailCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={S.detailScroll} showsVerticalScrollIndicator={false}>
              <Text style={S.detailTitle}>{selected.name}</Text>
              <Text style={S.detailSub}>{[selected.city, selected.address].filter(Boolean).join(" · ")}</Text>

              <Text style={S.detailBig}>{money(selected.total)}</Text>
              <Text style={S.popupBigCap}>סה״כ הוצאה</Text>

              <View style={S.detailGrid}>
                <Small value={String(selected.visits)} label="שימושים" />
                <Small value={money(selected.total / Math.max(1, selected.visits))} label="ממוצע לשימוש" />
                <Small value={ltr(`${monthOf(selected.first)} → ${monthOf(selected.last)}`)} label="מתי" />
              </View>

              {monthlySpend(selected).length > 1 ? (
                <View style={S.monthChart}>
                  <Text style={S.monthChartTitle}>הוצאה לפי חודש</Text>
                  <View style={S.monthBars}>
                    {(() => {
                      const series = monthlySpend(selected).slice(-12);
                      const max = Math.max(...series.map(([, value]) => value), 1);
                      return series.map(([month, amount]) => (
                        <View key={month} style={S.monthBarCell}>
                          <View style={[S.monthBar, { height: Math.max(8, (amount / max) * 72) }]} />
                          <Text style={S.monthBarLabel}>{month.slice(5)}</Text>
                        </View>
                      ));
                    })()}
                  </View>
                </View>
              ) : null}

              <View style={S.detailActions}>
                <TouchableOpacity
                  onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`)}
                  style={S.detailAction}
                >
                  <Text style={S.detailActionText}>פתיחה במפות</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openCorrection(selected)} style={S.detailAction}>
                  <Text style={S.detailActionText}>תיקון פרטים</Text>
                </TouchableOpacity>
              </View>

              {correctionOpen ? (
                <View style={S.correctionForm}>
                  <TextInput value={editName} onChangeText={setEditName} placeholder="שם המקום" placeholderTextColor="#9aa1ac" style={S.correctionInput} />
                  <TextInput value={editCity} onChangeText={setEditCity} placeholder="עיר" placeholderTextColor="#9aa1ac" style={S.correctionInput} />
                  <View style={S.correctionCoords}>
                    <TextInput value={editLat} onChangeText={setEditLat} keyboardType="decimal-pad" placeholder="קו רוחב" placeholderTextColor="#9aa1ac" style={[S.correctionInput, S.correctionCoordInput]} />
                    <TextInput value={editLng} onChangeText={setEditLng} keyboardType="decimal-pad" placeholder="קו אורך" placeholderTextColor="#9aa1ac" style={[S.correctionInput, S.correctionCoordInput]} />
                  </View>
                  <View style={S.correctionButtons}>
                    <TouchableOpacity onPress={() => setCorrectionOpen(false)} style={S.correctionCancel}>
                      <Text style={S.correctionCancelText}>ביטול</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={saveCorrection} style={S.correctionSave}>
                      <Text style={S.correctionSaveText}>שמירה במכשיר</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {selected.transactions.length ? (
                <>
                  <TouchableOpacity onPress={() => setDrillOpen((open) => !open)} style={S.drillToggle}>
                    <Text style={S.drillToggleText}>
                      {drillOpen ? "הסתר שימושים ▴" : `כל ${selected.transactions.length} השימושים ▾`}
                    </Text>
                  </TouchableOpacity>
                  {drillOpen ? (
                    <View style={S.drillList}>
                      {selected.transactions.map((txn) => (
                        <View key={txn.id} style={S.drillRow}>
                          <Text style={S.drillDate}>{dateLabel(txn.date || "")}</Text>
                          <Text style={S.drillMethod} numberOfLines={1}>{txn.source}</Text>
                          <Text style={S.drillAmount}>{money(txn.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#05070d" },

  markerWrap: { alignItems: "center", width: 120 },
  marker: { borderColor: "rgba(255,255,255,0.7)", opacity: 0.85 },
  markerLabel: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    color: "#1f2430",
    textShadowColor: "#ffffff",
    textShadowRadius: 3,
  },

  appBack: {
    position: "absolute",
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 14,
  },
  searchAreaBtn: {
    position: "absolute",
    alignSelf: "center",
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    elevation: 3,
    zIndex: 13,
  },
  searchAreaText: { fontSize: 13, fontWeight: "800", color: "#1a56c4" },
  areaFeedback: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(18,20,26,0.88)",
    zIndex: 13,
  },
  areaFeedbackText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  locationError: {
    position: "absolute",
    left: 18,
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    zIndex: 13,
  },
  locationErrorText: { color: "#b91c1c", fontSize: 11 },

  controlDock: {
    position: "absolute",
    left: 12,
    width: 50,
    alignItems: "center",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    elevation: 4,
    zIndex: 12,
  },
  controlButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },

  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    zIndex: 10,
    elevation: 12,
    shadowColor: "#05070d",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -12 },
  },
  sheetHandle: { height: 30, alignItems: "center", justifyContent: "center" },
  sheetHandleBar: { width: 38, height: 5, borderRadius: 999, backgroundColor: "#d5d9e0" },
  panelScroll: { flex: 1 },
  panelContent: { paddingBottom: 24 },

  head: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#eceef2" },
  cityBack: { minHeight: 40, justifyContent: "center" },
  cityBackText: { color: "#1a56c4", fontSize: 13, fontWeight: "800", textAlign: "right" },
  title: { fontSize: 21, fontWeight: "800", color: "#12141a", textAlign: "right" },
  subtitle: { fontSize: 11.5, color: "#8b929d", marginTop: 3, textAlign: "right" },

  bigStats: { flexDirection: "row-reverse", gap: 8, marginTop: 14, marginBottom: 12 },
  bigCell: { flex: 1, alignItems: "flex-end" },
  bigValue: { fontSize: 19, fontWeight: "800", color: "#12141a" },
  bigLabel: { fontSize: 10, color: "#9aa1ac", marginTop: 2 },

  tabs: { flexDirection: "row-reverse", gap: 4, backgroundColor: "#f1f3f6", borderRadius: 11, padding: 3 },
  tab: { flex: 1, borderRadius: 7, minHeight: 40, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: "#fff", elevation: 1, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontSize: 14, fontWeight: "700", color: "#6d7481" },
  tabTextOn: { color: "#12141a" },

  legendToggle: { minHeight: 40, marginTop: 8, justifyContent: "center" },
  legendToggleText: { color: "#6d7481", fontSize: 11.5, fontWeight: "700", textAlign: "right" },
  legend: { marginTop: 4 },
  legendCap: { fontSize: 9.5, fontWeight: "800", color: "#9aa1ac", letterSpacing: 0.8, textAlign: "right" },
  legendRow: { flexDirection: "row-reverse", gap: 3, marginTop: 5 },
  legendCell: { flex: 1 },
  legendSwatch: { height: 7, borderRadius: 3 },
  legendLabel: { fontSize: 9.5, color: "#8b929d", marginTop: 3, textAlign: "center" },
  legendNote: { fontSize: 10.5, color: "#9aa1ac", marginTop: 6, textAlign: "right" },

  search: {
    height: 44,
    marginTop: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e2e5ea",
    backgroundColor: "#f7f8fa",
    paddingHorizontal: 11,
    fontSize: 16,
    color: "#12141a",
    textAlign: "right",
  },
  filterChips: { flexDirection: "row-reverse", gap: 7, marginTop: 10, paddingBottom: 2 },
  filterChip: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dfe4ec",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  filterChipOn: { borderColor: "#4285f4", backgroundColor: "#eaf2ff" },
  filterChipText: { color: "#59616d", fontSize: 13, fontWeight: "700" },
  filterChipTextOn: { color: "#1a56c4" },

  sectionCap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, fontSize: 9.5, fontWeight: "800", color: "#9aa1ac", letterSpacing: 0.8, textAlign: "right" },
  sectionCapDim: { fontWeight: "600", color: "#b6bcc5" },

  insightGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  insightCard: {
    width: "48%",
    padding: 11,
    borderRadius: 11,
    backgroundColor: "#f7f8fa",
    borderWidth: 1,
    borderColor: "#eceef2",
    alignItems: "flex-end",
    gap: 3,
  },
  insightValue: { fontSize: 13, fontWeight: "800", color: "#12141a", textAlign: "right" },
  insightLabel: { fontSize: 11, color: "#8b929d", textAlign: "right" },

  cityRow: { paddingHorizontal: 16, paddingTop: 9, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#f4f5f8" },
  cityRowOn: { backgroundColor: "#edf4ff" },
  cityTop: { flexDirection: "row-reverse", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  cityName: { flex: 1, fontSize: 13, fontWeight: "700", color: "#12141a", textAlign: "right" },
  cityMoney: { fontSize: 13, fontWeight: "800", color: "#12141a" },
  barTrack: { height: 3, backgroundColor: "#eef0f4", borderRadius: 999, marginTop: 5, flexDirection: "row-reverse" },
  barFill: { height: 3, backgroundColor: "#4285f4", borderRadius: 999 },
  cityMeta: { fontSize: 10, color: "#a3a9b3", marginTop: 4, textAlign: "left" },

  spotRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingVertical: 8 },
  spotRowOn: { backgroundColor: "#edf4ff" },
  spotRank: { fontSize: 10.5, color: "#b6bcc5", width: 16, fontWeight: "700", textAlign: "center" },
  spotMain: { flex: 1, minWidth: 0 },
  spotName: { fontSize: 12.5, fontWeight: "700", color: "#12141a", textAlign: "right" },
  spotCity: { fontSize: 10, color: "#a3a9b3", marginTop: 1, textAlign: "right" },
  spotRight: { alignItems: "flex-start" },
  spotMoney: { fontSize: 12.5, fontWeight: "800", color: "#12141a" },
  spotVisits: { fontSize: 10, color: "#a3a9b3" },

  pagination: { minHeight: 44, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  paginationDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#cfd5df" },
  paginationDotActive: { width: 22, backgroundColor: "#4285f4" },

  skeletonWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  skeletonRow: { height: 54, marginBottom: 8, borderRadius: 10, backgroundColor: "#f0f2f5" },
  loading: { padding: 16, fontSize: 13, color: "#8b929d", textAlign: "right" },
  error: { padding: 16, fontSize: 13, color: "#b91c1c", textAlign: "right" },
  errorDetail: { color: "#b91c1c" },
  empty: { paddingHorizontal: 16, paddingVertical: 24, alignItems: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#2b3140", marginBottom: 6 },
  emptyBody: { fontSize: 13, lineHeight: 21, color: "#6d7481", textAlign: "center" },

  detail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 20,
  },
  detailHeader: {
    minHeight: 58,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eceef2",
  },
  detailBack: { minHeight: 44, justifyContent: "center" },
  detailBackText: { color: "#1a56c4", fontSize: 15, fontWeight: "800" },
  detailClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  detailCloseText: { color: "#8b929d", fontSize: 25 },
  detailScroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  detailTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: "#12141a", textAlign: "right" },
  detailSub: { marginTop: 5, fontSize: 14, lineHeight: 20, color: "#8b929d", textAlign: "right" },
  detailBig: { marginTop: 18, fontSize: 38, fontWeight: "800", color: "#1a56c4", textAlign: "right" },
  popupBigCap: { fontSize: 9.5, fontWeight: "800", color: "#9aa1ac", letterSpacing: 0.8, textAlign: "right" },
  detailGrid: {
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eceef2",
  },
  smallCell: { flex: 1, alignItems: "flex-end" },
  smallValue: { fontSize: 12.5, fontWeight: "800", color: "#12141a" },
  smallLabel: { fontSize: 9.5, color: "#9aa1ac", marginTop: 2 },

  monthChart: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#eceef2" },
  monthChartTitle: { fontSize: 12, fontWeight: "800", color: "#6d7481", marginBottom: 10, textAlign: "right" },
  monthBars: { height: 94, flexDirection: "row", alignItems: "flex-end", gap: 5 },
  monthBarCell: { flex: 1, alignItems: "center", gap: 3 },
  monthBar: { width: "100%", maxWidth: 20, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: "#4285f4" },
  monthBarLabel: { fontSize: 9.5, color: "#9aa1ac" },

  detailActions: { flexDirection: "row-reverse", gap: 9, marginTop: 16 },
  detailAction: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#dfe4ec",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailActionText: { color: "#1a56c4", fontSize: 13, fontWeight: "800" },

  correctionForm: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#f7f8fa" },
  correctionInput: {
    minHeight: 44,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#dfe4ec",
    borderRadius: 9,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    fontSize: 16,
    color: "#12141a",
    textAlign: "right",
  },
  correctionCoords: { flexDirection: "row-reverse", gap: 8 },
  correctionCoordInput: { flex: 1 },
  correctionButtons: { flexDirection: "row-reverse", justifyContent: "flex-start", gap: 8 },
  correctionCancel: { minHeight: 40, justifyContent: "center", paddingHorizontal: 6 },
  correctionCancelText: { color: "#6d7481", fontWeight: "700" },
  correctionSave: { minHeight: 40, borderRadius: 9, backgroundColor: "#1a56c4", paddingHorizontal: 14, justifyContent: "center" },
  correctionSaveText: { color: "#fff", fontWeight: "800" },

  drillToggle: {
    minHeight: 48,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#dfe4ec",
    backgroundColor: "#f7f8fa",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  drillToggleText: { fontSize: 14, fontWeight: "800", color: "#2874e6" },
  drillList: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#eceef2" },
  drillRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f5",
  },
  drillDate: { color: "#6d7481", fontSize: 13 },
  drillMethod: { flex: 1, color: "#a3a9b3", fontSize: 11.5, textAlign: "right" },
  drillAmount: { fontWeight: "800", color: "#12141a", fontSize: 13 },
});
