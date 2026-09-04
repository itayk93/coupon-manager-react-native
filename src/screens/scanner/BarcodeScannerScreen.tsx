import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Platform,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Modal,
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
  ImagePlus,
  HelpCircle,
  MessageSquareText,
  BadgeCheck,
} from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/button";
import { useParseCoupon, ParsedCoupon } from "@/hooks/useCouponAI";
import { useAppTheme } from "@/contexts/ThemeContext";
import { CharacterSpotlight } from "@/components/onboarding/CharacterRig";
import { fonts } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { usePageTutorial } from "@/hooks/usePageTutorial";
import { storeSharedCouponImport } from "@/lib/sharedCouponImport";

export function BarcodeScannerScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const compactLayout = width < 380 || fontScale > 1.2;
  const aiTitleFontSize = width < 350 || fontScale >= 1.3 ? 13 : compactLayout ? 14 : 16;
  const compactImageButtons = width < 360 || fontScale >= 1.3;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [scanned, setScanned] = useState(false);
  const [scanningAi, setScanningAi] = useState(false);
  // `onBarcodeScanned` fires several times per second, and a state update does
  // not land before the next frame's callbacks — so the guard has to be a ref,
  // or one barcode produces a burst of toasts and navigations.
  const scannedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"camera" | "ai">("ai");
  const [aiText, setAiText] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialAutoOpened = useRef(false);
  const parseCoupon = useParseCoupon();
  const pageTutorial = usePageTutorial("coupon_import");

  useEffect(() => {
    if (
      pageTutorial.isReady &&
      !pageTutorial.hasSeen &&
      !tutorialAutoOpened.current
    ) {
      tutorialAutoOpened.current = true;
      setShowTutorial(true);
    }
  }, [pageTutorial.hasSeen, pageTutorial.isReady]);

  const closeTutorial = () => {
    setShowTutorial(false);
    if (!pageTutorial.hasSeen) {
      void pageTutorial.markSeen().catch((error) => {
        console.error("Failed to save tutorial progress:", error);
      });
    }
  };

  /// Barcode decode only ever yields the raw code — company, value and expiry
  /// come from a photo of the voucher at the moment of the scan, run through
  /// the same AI parser image uploads use. Falls back to the bare code (old
  /// behavior) if the snapshot or the AI call fails, so a scan never dead-ends.
  const handleBarcodeScanned = async ({ data, type }: { data: string; type: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanned(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    const fallbackToRawCode = () => {
      router.push({
        pathname: "/coupons/add",
        params: { initialCode: data },
      });
    };

    try {
      setScanningAi(true);
      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.6,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        fallbackToRawCode();
        return;
      }

      const results = await parseCoupon.mutateAsync({
        text: `קוד קופון שנסרק: ${data}`,
        imageBase64: photo.base64,
      });

      if (results && results.length > 0) {
        // The AI reads the code from the photo too, but the scanner's decode
        // is exact — prefer it over whatever the model transcribed.
        goToAddCoupon({ ...results[0], code: results[0].code || data });
      } else {
        fallbackToRawCode();
      }
    } catch (e: any) {
      console.error(e);
      fallbackToRawCode();
    } finally {
      setScanningAi(false);
    }
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
    const importId = `scanner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storeSharedCouponImport(importId, parsed);
    router.push({
      pathname: "/coupons/add",
      params: { initialImportId: importId },
    });
  };

  /// Text stays an explicit action so the user can finish pasting or editing it.
  /// Images take the shorter path below and parse as soon as the picker returns.
  const handleParse = async () => {
    if (!aiText.trim()) {
      notify.error("יש להדביק טקסט של השובר");
      return;
    }

    try {
      const results = await parseCoupon.mutateAsync({
        text: aiText.trim(),
      });
      if (results && results.length > 0) {
        goToAddCoupon(results[0]);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  /// Reads and parses a voucher immediately after the camera or library picker
  /// returns. There is no intermediate image-preview confirmation: choosing the
  /// image is the user's instruction to extract it.
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

      const results = await parseCoupon.mutateAsync({
        text: aiText.trim() || undefined,
        imageBase64: asset.base64,
      });
      if (results.length > 0) {
        goToAddCoupon(results[0]);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header
        title="קופון חדש בקליק"
        subtitle="טקסט, תמונה או סריקה — מה שנוח"
        showBack
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity
            onPress={() => setShowTutorial(true)}
            style={[styles.helpButton, { backgroundColor: theme.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel="הצגת מדריך למסך הוספת קופון"
          >
            <HelpCircle size={20} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Top Mode Selector Tabs */}
        <View style={[styles.tabSelector, compactLayout && styles.tabSelectorCompact]}>
          <TouchableOpacity
            onPress={() => setActiveTab("ai")}
            style={[
              styles.tabBtn,
              compactLayout && styles.tabBtnCompact,
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
              טקסט או תמונה
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/coupons/add")}
            style={[
              styles.tabBtn,
              compactLayout && styles.tabBtnCompact,
              { backgroundColor: theme.surfaceAlt },
            ]}
          >
            <PlusCircle size={18} color={theme.textMuted} />
            <Text style={[styles.tabBtnText, { color: theme.textMuted }]}>
              טופס ידני
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
                  ref={cameraRef}
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

                {scanningAi ? (
                  <View style={styles.overlay} pointerEvents="none">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={[styles.overlayText, { marginTop: 12 }]}>
                      קורא פרטי קופון עם AI...
                    </Text>
                  </View>
                ) : scanned ? (
                  <TouchableOpacity
                    onPress={() => {
                      scannedRef.current = false;
                      setScanned(false);
                    }}
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
          <ScrollView
            style={styles.aiContainer}
            contentContainerStyle={styles.aiContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
                <Sparkles size={20} color={theme.primary} style={styles.aiHeaderIcon} />
                <Text style={[styles.aiTitle, { color: theme.text, fontSize: aiTitleFontSize }]}>
                  יש קופון? מדביקים וממשיכים
                </Text>
              </View>
              <Text style={[styles.aiSubtitle, { color: theme.textMuted }]}>
                מערכת ה-AI תחלץ אוטומטית את שם החברה, קוד הקופון, השווי והתוקף.
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
                    title={fontScale > 1.2 ? "מהגלריה" : "בחר מהגלריה"}
                    variant="outline"
                    size={compactImageButtons ? "sm" : "md"}
                    style={compactImageButtons ? styles.imageBtnCompact : undefined}
                    textStyle={compactImageButtons ? styles.imageBtnTextCompact : undefined}
                    onPress={() => handlePickImage("library")}
                    disabled={parseCoupon.isPending}
                    icon={<ImagePlus size={18} color={theme.primary} />}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="סריקת קוד"
                    variant="outline"
                    size={compactImageButtons ? "sm" : "md"}
                    style={compactImageButtons ? styles.imageBtnCompact : undefined}
                    textStyle={compactImageButtons ? styles.imageBtnTextCompact : undefined}
                    onPress={() => setActiveTab("camera")}
                    disabled={parseCoupon.isPending}
                    icon={<QrCode size={18} color={theme.primary} />}
                  />
                </View>
              </View>

              <Button
                title="חלץ פרטים והוסף קופון"
                onPress={handleParse}
                loading={parseCoupon.isPending}
                disabled={!aiText.trim()}
                icon={<Sparkles size={18} color="#ffffff" />}
                style={{ marginTop: 16 }}
              />

              {parseCoupon.isPending ? (
                <View
                  style={[
                    styles.loadingOverlay,
                    { backgroundColor: `${theme.background}D9` },
                  ]}
                  accessibilityViewIsModal
                  accessibilityRole="progressbar"
                  accessibilityLabel="בודקים את החברה, הקוד והסכומים"
                  accessibilityLiveRegion="polite"
                >
                  <View
                    style={[
                      styles.loadingModal,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <CharacterSpotlight
                      character="investigator"
                      state="scanning"
                      size="small"
                    />
                    <Text
                      style={[styles.characterLoadingText, { color: theme.textMuted }]}
                    >
                      בודקים את החברה, הקוד והסכומים…
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}

      </View>

      <Modal
        visible={showTutorial}
        transparent
        animationType="fade"
        onRequestClose={closeTutorial}
        statusBarTranslucent
      >
        <View style={styles.tutorialBackdrop}>
          <View
            style={[
              styles.tutorialCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.tutorialMascot}>
              <CharacterSpotlight
                character="investigator"
                state="talking"
                size="small"
                tone="blue"
              />
            </View>
            <Text style={[styles.tutorialTitle, { color: theme.text }]}>קופון נכנס. הפרטים מסתדרים.</Text>
            <Text style={[styles.tutorialSubtitle, { color: theme.textMuted }]}>
              לא צריך להקליד הכול ידנית. בוחרים דרך, וה־AI עושה את העבודה.
            </Text>

            <View style={styles.tutorialSteps}>
              <TutorialStep
                icon={<MessageSquareText size={20} color={theme.primary} />}
                title="מדביקים את מה שקיבלת"
                text="הודעת SMS, מייל או כל טקסט של השובר."
                iconBackground={theme.primaryTint}
                textColor={theme.text}
                mutedColor={theme.textMuted}
              />
              <TutorialStep
                icon={<BadgeCheck size={20} color={theme.success} />}
                title="הפרטים מתמלאים לבד"
                text="שם החברה, קוד הקופון, השווי והתוקף."
                iconBackground={theme.successBg}
                textColor={theme.text}
                mutedColor={theme.textMuted}
              />
              <TutorialStep
                icon={<Camera size={20} color={theme.accent} />}
                title="אפשר גם בלי טקסט"
                text="מצרפים תמונה, מצלמים שובר או סורקים קוד."
                iconBackground={theme.surface}
                textColor={theme.text}
                mutedColor={theme.textMuted}
              />
            </View>

            <Button title="יאללה, מוסיפים קופון" onPress={closeTutorial} />
            <TouchableOpacity
              onPress={closeTutorial}
              style={styles.tutorialSkip}
              accessibilityRole="button"
            >
              <Text style={[styles.tutorialSkipText, { color: theme.textMuted }]}>אולי אחר כך</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TutorialStep({
  icon,
  title,
  text,
  iconBackground,
  textColor,
  mutedColor,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  iconBackground: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.tutorialStep}>
      <View style={[styles.tutorialStepIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.tutorialStepCopy}>
        <Text style={[styles.tutorialStepTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.tutorialStepText, { color: mutedColor }]}>{text}</Text>
      </View>
    </View>
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
  helpButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  tutorialCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  tutorialMascot: {
    height: 94,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tutorialTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "rtl",
  },
  tutorialSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 6,
  },
  tutorialSteps: {
    gap: 13,
    marginVertical: 20,
  },
  tutorialStep: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  tutorialStepIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialStepCopy: {
    flex: 1,
    alignItems: "flex-end",
  },
  tutorialStepTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  tutorialStepText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 1,
  },
  tutorialSkip: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  tutorialSkipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: "600",
    writingDirection: "rtl",
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
  imageBtnCompact: {
    paddingHorizontal: 6,
  },
  imageBtnTextCompact: {
    fontSize: 10.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    padding: 20,
    zIndex: 10,
  },
  loadingModal: {
    width: "100%",
    maxWidth: 250,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  characterLoadingText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  tabSelector: {
    flexDirection: "row-reverse",
    gap: 8,
    marginBottom: 14,
  },
  tabSelectorCompact: {
    flexDirection: "column",
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
  tabBtnCompact: {
    flex: 0,
    minHeight: 48,
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
  aiContent: {
    paddingBottom: 4,
  },
  aiCard: {
    position: "relative",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  aiHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  aiTitle: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  aiHeaderIcon: {
    flexShrink: 0,
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
});
