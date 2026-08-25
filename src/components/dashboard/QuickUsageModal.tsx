import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { CheckCheck, Check, ChevronDown, MapPin, ImagePlus, Sparkles, Trash2 } from "lucide-react-native";
import * as Location from "expo-location";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { useRecordUsage } from "@/hooks/useCouponUsage";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { CouponLocationMap } from "@/components/maps/CouponLocationMap";
import { supabase } from "@/integrations/supabase/client";
import { ParsedUsage, useParseUsageScreenshot } from "@/hooks/useUsageAI";

type QuickUsageModalProps = {
  visible: boolean;
  onClose: () => void;
  coupons: DecryptedCoupon[];
  preselectedCoupon?: DecryptedCoupon | null;
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export function QuickUsageModal({
  visible,
  onClose,
  coupons,
  preselectedCoupon,
}: QuickUsageModalProps) {
  const { theme } = useAppTheme();
  const recordUsage = useRecordUsage();
  const parseUsage = useParseUsageScreenshot();

  const activeCoupons = coupons.filter(
    (c) => !c.is_for_sale && c.status !== "נוצל"
  );

  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(
    preselectedCoupon ? preselectedCoupon.id : activeCoupons[0]?.id || null
  );
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeSearchMessage, setPlaceSearchMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [isConfirmingFullUse, setIsConfirmingFullUse] = useState(false);
  const [detectedUsages, setDetectedUsages] = useState<ParsedUsage[]>([]);
  const [savingDetected, setSavingDetected] = useState(false);
  const resolvedPlaceQuery = useRef("");

  useEffect(() => {
    if (!visible) return;
    setSelectedCouponId(
      preselectedCoupon ? preselectedCoupon.id : activeCoupons[0]?.id ?? null
    );
    setAmount("");
    setDetails("");
    setPlaceName("");
    resolvedPlaceQuery.current = "";
    setPlaceAddress("");
    setLocation(null);
    setIsSearchingPlace(false);
    setPlaceSearchMessage("");
    setError("");
    setIsPickerOpen(false);
    setIsConfirmingFullUse(false);
    setDetectedUsages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, preselectedCoupon?.id]);

  useEffect(() => {
    const query = placeName.trim();
    if (!visible || query.length < 3) {
      setPlaceSearchMessage("");
      return;
    }
    if (resolvedPlaceQuery.current === query) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingPlace(true);
      setPlaceSearchMessage("");
      const { data, error } = await supabase.functions.invoke("geocode-address", {
        body: { query },
      });
      if (cancelled) return;
      setIsSearchingPlace(false);
      if (error || !data?.result) {
        const diagnostics = Array.isArray(data?.diagnostics) ? data.diagnostics.join(", ") : "אין תשובת Google";
        setPlaceSearchMessage(`Google לא מצא את המקום (${diagnostics})`);
        return;
      }
      const result = data.result as {
        placeName: string;
        address: string;
        latitude: number | null;
        longitude: number | null;
      };
      resolvedPlaceQuery.current = result.placeName || query;
      if (result.placeName && result.placeName !== query) setPlaceName(result.placeName);
      setPlaceAddress(result.address || "");
      if (result.latitude !== null && result.longitude !== null) {
        setLocation({ latitude: result.latitude, longitude: result.longitude });
        setPlaceSearchMessage("המקום נמצא והמפה עודכנה");
      } else {
        setLocation(null);
        const diagnostics = Array.isArray(data?.diagnostics) ? ` (${data.diagnostics.join(", ")})` : "";
        setPlaceSearchMessage(`הכתובת נמצאה, אבל Google לא החזיר קואורדינטות${diagnostics}`);
      }
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placeName, visible]);

  const useCurrentLocation = async () => {
    setIsLocating(true);
    setPlaceSearchMessage("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setPlaceSearchMessage("צריך לאפשר גישה למיקום כדי לרשום את המקום הנוכחי.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLocation = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setLocation(nextLocation);
      const [address] = await Location.reverseGeocodeAsync(nextLocation);
      const formattedAddress = [address?.street, address?.streetNumber, address?.city].filter(Boolean).join(", ");
      if (formattedAddress) setPlaceAddress(formattedAddress);
      setPlaceName("המקום שבו אני נמצא");
      setPlaceSearchMessage("המיקום הנוכחי נרשם");
    } catch {
      setPlaceSearchMessage("לא הצלחתי לקרוא את המיקום. אפשר לבחור נקודה במפה.");
    } finally {
      setIsLocating(false);
    }
  };

  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId);
  const remaining = selectedCoupon
    ? Math.max(0, (selectedCoupon.value || 0) - (selectedCoupon.used_value || 0))
    : 0;

  const submitUsage = async (numAmount: number, usageDetails: string) => {
    await recordUsage.mutateAsync({
      couponId: selectedCouponId as number,
      usedAmount: numAmount,
      details: usageDetails,
      placeName,
      placeAddress,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    setAmount("");
    setDetails("");
    setPlaceName("");
    setPlaceAddress("");
    setLocation(null);
    setError("");
    onClose();
  };

  const handleConfirmFullUse = async () => {
    if (!selectedCouponId || remaining <= 0) return;
    try {
      await submitUsage(remaining, details.trim() || "סימון הקופון כנוצל");
      setIsConfirmingFullUse(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCouponId) {
      setError("יש לבחור קופון לדיווח");
      return;
    }
    const numAmount = Number(amount);
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      setError("יש להזין סכום שימוש חיובי");
      return;
    }
    if (numAmount > remaining) {
      setError(`הסכום שהוזן (${formatIls(numAmount)}) גבוה מהיתרה (${formatIls(remaining)})`);
      return;
    }

    try {
      await submitUsage(numAmount, details.trim() || "שימוש מהיר באפליקציה");
    } catch (e) {
      console.error(e);
    }
  };

  const pickUsageScreenshot = async () => {
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = require("expo-image-picker");
    } catch {
      setError("זיהוי מתמונה אינו זמין בגרסה המותקנת");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("צריך לאפשר גישה לתמונות כדי להעלות צילום מסך");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.6,
    });
    if (result.canceled) return;
    const base64 = result.assets?.[0]?.base64;
    if (!base64) {
      setError("לא ניתן לקרוא את התמונה");
      return;
    }
    setError("");
    try {
      setDetectedUsages(await parseUsage.mutateAsync(base64));
    } catch (e) {
      console.error(e);
    }
  };

  const updateDetectedUsage = (id: string, field: keyof ParsedUsage, value: string | number) => {
    setDetectedUsages((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const saveDetectedUsages = async () => {
    if (!selectedCouponId) return setError("יש לבחור קופון");
    const valid = detectedUsages.filter((item) => item.amount > 0);
    const total = valid.reduce((sum, item) => sum + item.amount, 0);
    if (!valid.length) return setError("לא נשארו שימושים תקינים לאישור");
    if (total > remaining) return setError(`סך השימושים (${formatIls(total)}) גבוה מהיתרה (${formatIls(remaining)})`);
    setSavingDetected(true);
    setError("");
    try {
      for (const item of valid) {
        await recordUsage.mutateAsync({
          couponId: selectedCouponId,
          usedAmount: item.amount,
          details: item.details,
          placeName: item.placeName,
          placeAddress: item.placeAddress,
          latitude: item.latitude,
          longitude: item.longitude,
          timestamp: item.usedAt,
        });
      }
      setDetectedUsages([]);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingDetected(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="דיווח מהיר על שימוש"
      subtitle="הורד סכום שנוצל מיתרת הקופון"
    >
      <View style={styles.container}>
        {/* Coupon Selector */}
        <Text style={[styles.label, { color: theme.text }]}>בחר קופון</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsPickerOpen(!isPickerOpen)}
          style={[
            styles.couponSelector,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.border,
            },
          ]}
        >
          <ChevronDown size={18} color={theme.textMuted} />
          {selectedCoupon ? (
            <View style={styles.selectedCouponRow}>
              <View style={styles.selectedTextGroup}>
                <Text
                  numberOfLines={1}
                  style={[styles.couponName, { color: theme.text }]}
                >
                  {selectedCoupon.company}
                </Text>
                <Text style={[styles.couponBalance, { color: theme.primary }]}>
                  יתרה: {formatIls(remaining)}
                </Text>
              </View>
              <Image
                source={getCompanyLogoSource(selectedCoupon.company)}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          ) : (
            <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
              לא נבחרו קופונים
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={pickUsageScreenshot}
          disabled={parseUsage.isPending}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="העלאת צילום מסך לדיווח שימושים"
          style={[styles.aiUploadButton, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}
        >
          {parseUsage.isPending ? <ActivityIndicator color={theme.primary} /> : <ImagePlus size={22} color={theme.primary} />}
          <View style={styles.aiUploadText}>
            <Text style={[styles.aiUploadTitle, { color: theme.text }]}>
              {parseUsage.isPending ? "ה-AI קורא ומאתר מקומות..." : "דיווח מצילום מסך"}
            </Text>
            <Text style={[styles.aiUploadSubtitle, { color: theme.textMuted }]}>העלאה, זיהוי שימושים ומיקום אוטומטי</Text>
          </View>
          <Sparkles size={18} color={theme.primary} />
        </TouchableOpacity>

        {detectedUsages.length ? (
          <View style={styles.detectedSection}>
            <View style={styles.detectedHeader}>
              <Text style={[styles.detectedCount, { color: theme.primary }]}>{detectedUsages.length} שימושים זוהו</Text>
              <Text style={[styles.detectedTitle, { color: theme.text }]}>בדיקה לפני אישור</Text>
            </View>
            {detectedUsages.map((item, index) => (
              <View key={item.id} style={[styles.usageCard, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
                <View style={styles.usageCardHeader}>
                  <TouchableOpacity
                    accessibilityLabel={`מחיקת שימוש ${index + 1}`}
                    onPress={() => setDetectedUsages((all) => all.filter((row) => row.id !== item.id))}
                    style={styles.deleteUsage}
                  ><Trash2 size={18} color={theme.danger} /></TouchableOpacity>
                  <Text style={[styles.usageIndex, { color: theme.text }]}>שימוש {index + 1}</Text>
                </View>
                <Input label="סכום (₪)" keyboardType="decimal-pad" value={String(item.amount)} onChangeText={(value) => updateDetectedUsage(item.id, "amount", Number(value) || 0)} />
                <Input label="מקום" value={item.placeName} onChangeText={(value) => updateDetectedUsage(item.id, "placeName", value)} />
                <Input label="כתובת" value={item.placeAddress} placeholder="לא נמצאה כתובת — אפשר לערוך" onChangeText={(value) => updateDetectedUsage(item.id, "placeAddress", value)} />
                <Input label="מועד השימוש" value={item.usedAt || ""} placeholder="YYYY-MM-DDTHH:mm:ss" onChangeText={(value) => updateDetectedUsage(item.id, "usedAt", value)} />
                {item.latitude !== null && item.longitude !== null ? (
                  <Text style={[styles.detectedCoordinates, { color: theme.textMuted }]}><MapPin size={13} color={theme.primary} /> {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</Text>
                ) : null}
              </View>
            ))}
            {error ? <Text style={[styles.batchError, { color: theme.danger }]}>{error}</Text> : null}
            <Button title={`אישור והוספת ${detectedUsages.length} שימושים`} onPress={saveDetectedUsages} loading={savingDetected} disabled={savingDetected} />
          </View>
        ) : null}

        {/* Dropdown list if opened */}
        {isPickerOpen ? (
          <View
            style={[
              styles.dropdown,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <FlatList
              data={activeCoupons}
              keyExtractor={(c) => String(c.id)}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => {
                const rem = Math.max(0, (item.value || 0) - (item.used_value || 0));
                const isCurrent = item.id === selectedCouponId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCouponId(item.id);
                      setIsPickerOpen(false);
                      setIsConfirmingFullUse(false);
                      setError("");
                    }}
                    style={[
                      styles.dropdownItem,
                      {
                        backgroundColor: isCurrent
                          ? theme.primaryMuted
                          : "transparent",
                      },
                    ]}
                  >
                    {isCurrent ? (
                      <Check size={16} color={theme.primary} />
                    ) : (
                      <View style={{ width: 16 }} />
                    )}
                    <View style={styles.itemInfo}>
                      <Text
                        numberOfLines={1}
                        style={[styles.itemName, { color: theme.text }]}
                      >
                        {item.company} ({item.code ? "•••" + item.code.slice(-4) : ""})
                      </Text>
                      <Text
                        style={[styles.itemSub, { color: theme.textMuted }]}
                      >
                        יתרה: {formatIls(rem)}
                      </Text>
                    </View>
                    <Image
                      source={getCompanyLogoSource(item.company)}
                      style={styles.itemLogo}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : null}

        {/* Amount Input */}
        <View style={styles.amountContainer}>
          <Input
            label="סכום השימוש (₪) *"
            placeholder="0.00"
            keyboardType="numeric"
            value={amount}
            onChangeText={(val) => {
              setAmount(val);
              setError("");
            }}
            error={error}
          />
          {remaining > 0 ? (
            isConfirmingFullUse ? (
              <View
                style={[
                  styles.confirmBox,
                  { backgroundColor: theme.primaryMuted, borderColor: theme.primary },
                ]}
              >
                <Text style={[styles.confirmText, { color: theme.text }]}>
                  לסמן את כל היתרה שנותרה ({formatIls(remaining)}) כנוצלה?
                  הקופון יעבור לסטטוס "נוצל".
                </Text>
                <View style={styles.confirmActions}>
                  <Button
                    title="ביטול"
                    onPress={() => setIsConfirmingFullUse(false)}
                    variant="ghost"
                    size="md"
                    disabled={recordUsage.isPending}
                    style={styles.confirmBtn}
                  />
                  <Button
                    title="כן, סמן כנוצל"
                    onPress={handleConfirmFullUse}
                    variant="primary"
                    size="md"
                    loading={recordUsage.isPending}
                    style={styles.confirmBtn}
                  />
                </View>
              </View>
            ) : (
              <Button
                title={`סימון הקופון כנוצל (${formatIls(remaining)})`}
                onPress={() => setIsConfirmingFullUse(true)}
                variant="outline"
                size="lg"
                disabled={recordUsage.isPending}
                icon={<CheckCheck size={20} color={theme.primary} />}
                style={styles.fullUseBtn}
              />
            )
          ) : null}
        </View>

        {/* Details Input */}
        <Input
          label="פרטים נוספים (אופציונלי)"
          placeholder="הערה על השימוש"
          value={details}
          onChangeText={setDetails}
        />

        <Input
          label="שם המקום (אופציונלי)"
          placeholder="למשל: בית קפה דיזנגוף תל אביב"
          value={placeName}
          onChangeText={(value) => {
            setPlaceName(value);
            resolvedPlaceQuery.current = "";
            setPlaceSearchMessage("");
          }}
        />
        {isSearchingPlace || placeSearchMessage ? (
          <Text style={[styles.placeSearchMessage, { color: theme.textMuted }]}>
            {isSearchingPlace ? "מחפש את המקום..." : placeSearchMessage}
          </Text>
        ) : null}

        <Input
          label="כתובת המקום (אופציונלי)"
          placeholder="רחוב, מספר, עיר"
          value={placeAddress}
          onChangeText={setPlaceAddress}
        />

        <Text style={[styles.mapLabel, { color: theme.text }]}>מיקום במפה (אופציונלי)</Text>
        <Button
          title={isLocating ? "מאתר אותי..." : "רשום את המקום שבו אני נמצא"}
          onPress={useCurrentLocation}
          variant="outline"
          icon={<MapPin size={18} color={theme.primary} />}
          disabled={isLocating}
          style={styles.currentLocationButton}
        />
        <CouponLocationMap
          location={location}
          editable
          onLocationChange={setLocation}
          height={180}
        />
        {location ? (
          <Text style={[styles.coordinates, { color: theme.textMuted }]}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        ) : null}

        <Button
          title="רשום שימוש ועדכן יתרה"
          onPress={handleSubmit}
          loading={recordUsage.isPending}
          style={{ marginTop: 12 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  mapLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
    textAlign: "right",
  },
  coordinates: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
  placeSearchMessage: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    textAlign: "right",
  },
  currentLocationButton: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "right",
  },
  couponSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  selectedCouponRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  selectedTextGroup: {
    alignItems: "flex-end",
  },
  couponName: {
    fontSize: 14,
    fontWeight: "700",
  },
  couponBalance: {
    fontSize: 12,
    fontWeight: "600",
  },
  placeholderText: {
    fontSize: 14,
  },
  dropdown: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: -8,
    marginBottom: 14,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  itemInfo: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  itemLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  amountContainer: {
    marginBottom: 4,
  },
  fullUseBtn: {
    marginTop: 2,
    marginBottom: 12,
  },
  confirmBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginTop: 2,
    marginBottom: 12,
    gap: 10,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 19,
  },
  confirmActions: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
  },
  aiUploadButton: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aiUploadText: { flex: 1, alignItems: "flex-end" },
  aiUploadTitle: { fontSize: 15, fontWeight: "800", textAlign: "right" },
  aiUploadSubtitle: { fontSize: 12, marginTop: 3, textAlign: "right" },
  detectedSection: { gap: 10, marginBottom: 18 },
  detectedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detectedTitle: { fontSize: 17, fontWeight: "800" },
  detectedCount: { fontSize: 12, fontWeight: "700" },
  usageCard: { borderWidth: 1, borderRadius: 16, padding: 12 },
  usageCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  usageIndex: { fontSize: 14, fontWeight: "800" },
  deleteUsage: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  detectedCoordinates: { fontSize: 12, textAlign: "right", marginTop: -4, marginBottom: 4 },
  batchError: { fontSize: 13, fontWeight: "600", textAlign: "right" },
});
