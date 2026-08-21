import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import {
  QrCode,
  Sparkles,
  Camera,
  RotateCcw,
  PlusCircle,
  FileText,
  ImagePlus,
  X,
} from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/button";
import { useParseCoupon, ParsedCoupon } from "@/hooks/useCouponAI";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { notify } from "@/lib/notify";

export function BarcodeScannerScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  // `onBarcodeScanned` fires several times per second, and a state update does
  // not land before the next frame's callbacks — so the guard has to be a ref,
  // or one barcode produces a burst of toasts and navigations.
  const scannedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"camera" | "ai">("ai");
  const [aiText, setAiText] = useState("");
  // The picked image is held here rather than parsed on selection: the model
  // misses details on a busy screenshot often enough that the user wants to add
  // the surrounding text before spending a parse.
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageUri, setImageUri] = useState<string | undefined>();
  const parseCoupon = useParseCoupon();

  const handleBarcodeScanned = ({ data, type }: { data: string; type: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanned(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    // Navigate to Add Coupon prefilled with scanned code
    router.push({
      pathname: "/coupons/add",
      params: { initialCode: data },
    });
  };

  // Re-arm when the user comes back to the scanner rather than on a timer: the
  // screen stays mounted under the add-coupon route, and a timer would let the
  // camera keep firing while the user is filling in the form.
  useFocusEffect(
    useCallback(() => {
      scannedRef.current = false;
      setScanned(false);
    }, [])
  );

  /// Hands the parsed fields to the add-coupon form. Every field the parser
  /// resolved has to be forwarded here — anything left out silently comes back
  /// as an empty input, which is what used to happen to the expiry date.
  const goToAddCoupon = (parsed: ParsedCoupon) => {
    router.push({
      pathname: "/coupons/add",
      params: {
        initialCompany: parsed.company || "",
        initialCode: parsed.code || "",
        ...(parsed.value ? { initialValue: String(parsed.value) } : {}),
        ...(parsed.expiration
          ? { initialExpiration: parsed.expiration.slice(0, 10) }
          : {}),
        ...(parsed.description ? { initialDescription: parsed.description } : {}),
      },
    });
  };

  /// Sends whatever the user supplied — text, an image, or both. Together they
  /// read better than either alone: the picture carries the layout, the pasted
  /// text carries the small print the model tends to drop.
  const handleParse = async () => {
    if (!aiText.trim() && !imageBase64) {
      notify.error("יש להדביק טקסט או לצרף תמונה של השובר");
      return;
    }

    try {
      const results = await parseCoupon.mutateAsync({
        text: aiText.trim() || undefined,
        imageBase64,
      });
      if (results && results.length > 0) {
        goToAddCoupon(results[0]);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  /// Reads a voucher off a photo or screenshot. The barcode scanner only ever
  /// yields the code digits; the amount and expiry live in the surrounding
  /// text, so the picture itself has to reach the parser.
  ///
  /// expo-image-picker is loaded here rather than at the top of the file on
  /// purpose: its entry point calls `requireNativeModule` while the module is
  /// evaluated, which takes the whole screen down on a binary built before the
  /// dependency was added. Loading it on demand keeps the scanner usable and
  /// turns a missing native module into a message.
  const handlePickImage = async (source: "camera" | "library") => {
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = require("expo-image-picker");
    } catch {
      notify.error(
        "זיהוי מתמונה אינו זמין בגרסה המותקנת",
        "צריך להתקין מחדש את האפליקציה כדי להשתמש בו"
      );
      return;
    }

    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        notify.error(
          source === "camera"
            ? "אין הרשאה למצלמה"
            : "אין הרשאה לגלריית התמונות"
        );
        return;
      }

      const options: import("expo-image-picker").ImagePickerOptions = {
        mediaTypes: ["images"],
        base64: true,
        // Keeps the upload well under the parser's 8MB base64 cap without
        // costing the legibility the model needs to read small print.
        quality: 0.6,
      };

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        notify.error("לא ניתן לקרוא את התמונה");
        return;
      }

      setImageBase64(asset.base64);
      setImageUri(asset.uri);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRemoveImage = () => {
    setImageBase64(undefined);
    setImageUri(undefined);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="סורק שוברים וקודים" showBack onBack={() => router.back()} />

      <View style={styles.container}>
        {/* Top Mode Selector Tabs */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            onPress={() => setActiveTab("ai")}
            style={[
              styles.tabBtn,
              {
                backgroundColor:
                  activeTab === "ai"
                    ? theme.primary
                    : theme.surfaceAlt,
              },
            ]}
          >
            <Sparkles
              size={18}
              color={activeTab === "ai" ? "#ffffff" : theme.textMuted}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === "ai" ? "#ffffff" : theme.textMuted },
              ]}
            >
              הוספת קופון מטקסט
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("camera")}
            style={[
              styles.tabBtn,
              {
                backgroundColor:
                  activeTab === "camera"
                    ? theme.primary
                    : theme.surfaceAlt,
              },
            ]}
          >
            <Camera
              size={18}
              color={activeTab === "camera" ? "#ffffff" : theme.textMuted}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === "camera" ? "#ffffff" : theme.textMuted },
              ]}
            >
              סריקת מצלמה
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "camera" ? (
          <View style={styles.cameraContainer}>
            {!permission ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.statusText, { color: theme.textMuted }]}>
                  בודק הרשאות מצלמה...
                </Text>
              </View>
            ) : !permission.granted ? (
              <View style={styles.centerBox}>
                <QrCode size={56} color={theme.textMuted} />
                <Text style={[styles.permissionTitle, { color: theme.text }]}>
                  דרושה גישה למצלמה
                </Text>
                <Text style={[styles.permissionSubtitle, { color: theme.textMuted }]}>
                  כדי לסרוק ברקודים וקודי QR של קופונים בקלות
                </Text>
                <Button
                  title="אפשר גישה למצלמה"
                  onPress={requestPermission}
                  style={{ marginTop: 16 }}
                />
              </View>
            ) : (
              <View style={styles.cameraWrapper}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{
                    barcodeTypes: [
                      "qr",
                      "ean13",
                      "ean8",
                      "code128",
                      "code39",
                      "upc_e",
                      "datamatrix",
                    ],
                  }}
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />

                {/* Viewfinder Target Frame */}
                <View style={styles.overlay}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.topLeft, { borderColor: theme.primary }]} />
                    <View style={[styles.corner, styles.topRight, { borderColor: theme.primary }]} />
                    <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.primary }]} />
                    <View style={[styles.corner, styles.bottomRight, { borderColor: theme.primary }]} />
                  </View>
                  <Text style={styles.overlayText}>
                    כוון את המצלמה אל הברקוד או קוד ה-QR
                  </Text>
                </View>

                {scanned ? (
                  <TouchableOpacity
                    onPress={() => setScanned(false)}
                    style={[styles.rescanBtn, { backgroundColor: theme.primary }]}
                  >
                    <RotateCcw size={18} color="#ffffff" />
                    <Text style={styles.rescanText}>סרוק שוב</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.aiContainer}>
            <View
              style={[
                styles.aiCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.aiHeader}>
                <Text style={[styles.aiTitle, { color: theme.text }]}>
                  הדבק הודעת SMS או טקסט שקיבלת
                </Text>
                <Sparkles size={20} color={theme.primary} />
              </View>
              <Text style={[styles.aiSubtitle, { color: theme.textMuted }]}>
                מערכת ה-AI תחלץ אוטומטית את שם החברה, קוד הקופון, השווי והתוקף!
              </Text>

              <TextInput
                multiline
                numberOfLines={6}
                placeholder="למשל: שלום ישראל, קבל שובר על סך 100 ש״ח למגה ספורט. קוד: 123456 בתוקף עד 31.12.2026..."
                placeholderTextColor={theme.textMuted}
                value={aiText}
                onChangeText={setAiText}
                style={[
                  styles.aiInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <Text style={[styles.aiDividerText, { color: theme.textMuted }]}>
                אפשר גם לצרף תמונה של השובר
              </Text>

              <View style={styles.imageBtnRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="בחר מהגלריה"
                    variant="outline"
                    onPress={() => handlePickImage("library")}
                    disabled={parseCoupon.isPending}
                    icon={<ImagePlus size={18} color={theme.primary} />}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="צלם שובר"
                    variant="outline"
                    onPress={() => handlePickImage("camera")}
                    disabled={parseCoupon.isPending}
                    icon={<Camera size={18} color={theme.primary} />}
                  />
                </View>
              </View>

              {imageUri ? (
                <View
                  style={[
                    styles.imagePreviewRow,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                  ]}
                >
                  <TouchableOpacity onPress={handleRemoveImage} hitSlop={8}>
                    <X size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                  <Text
                    style={[styles.imagePreviewText, { color: theme.textMuted }]}
                    numberOfLines={1}
                  >
                    תמונה מצורפת
                  </Text>
                  <Image source={{ uri: imageUri }} style={styles.imageThumb} />
                </View>
              ) : null}

              <Button
                title="חלץ פרטים והוסף קופון"
                onPress={handleParse}
                loading={parseCoupon.isPending}
                disabled={!aiText.trim() && !imageBase64}
                icon={<Sparkles size={18} color="#ffffff" />}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        )}

        <View style={styles.manualAddContainer}>
          <Button
            title="הוספת קופון ידנית"
            onPress={() => router.push("/coupons/add")}
            icon={<PlusCircle size={18} color="#ffffff" />}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  aiDividerText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 10,
  },
  imageBtnRow: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  imagePreviewRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  imageThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  imagePreviewText: {
    flex: 1,
    fontSize: 12,
    textAlign: "right",
  },
  tabSelector: {
    flexDirection: "row-reverse",
    gap: 8,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
  },
  cameraWrapper: {
    flex: 1,
    position: "relative",
    borderRadius: 24,
    overflow: "hidden",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
  },
  permissionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 6,
  },
  permissionSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 240,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  overlayText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 24,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rescanBtn: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  rescanText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  aiContainer: {
    flex: 1,
  },
  aiCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  aiHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  aiTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
  aiSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    marginBottom: 14,
    textAlign: "right",
  },
  aiInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    height: 140,
    textAlignVertical: "top",
    textAlign: "right",
    fontSize: 14,
    lineHeight: 20,
  },
  manualAddContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
});
