import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import {
  QrCode,
  Sparkles,
  Camera,
  RotateCcw,
  PlusCircle,
  FileText,
} from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/button";
import { useParseCoupon } from "@/hooks/useCouponAI";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
import { notify } from "@/lib/notify";

export function BarcodeScannerScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [activeTab, setActiveTab] = useState<"camera" | "ai">("camera");
  const [aiText, setAiText] = useState("");
  const parseCoupon = useParseCoupon();

  const handleBarcodeScanned = ({ data, type }: { data: string; type: string }) => {
    if (scanned) return;
    setScanned(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    notify.success("הקוד נסרק בהצלחה!", data);

    // Navigate to Add Coupon prefilled with scanned code
    router.push({
      pathname: "/coupons/add",
      params: { initialCode: data },
    });

    setTimeout(() => setScanned(false), 2000);
  };

  const handleParseAiText = async () => {
    if (!aiText.trim()) {
      notify.error("יש להדביק או להקליד טקסט של קופון/SMS");
      return;
    }

    try {
      const results = await parseCoupon.mutateAsync({ text: aiText });
      if (results && results.length > 0) {
        const first = results[0];
        router.push({
          pathname: "/coupons/add",
          params: {
            initialCompany: first.company || "",
            initialCode: first.code || "",
            ...(first.value ? { initialValue: String(first.value) } : {}),
          },
        });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="סורק שוברים וקודים" showBack onBack={() => router.back()} />

      <View style={styles.container}>
        {/* Top Mode Selector Tabs */}
        <View style={styles.tabSelector}>
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
              זיהוי חכם (AI)
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

              <Button
                title="חלץ פרטים והוסף קופון"
                onPress={handleParseAiText}
                loading={parseCoupon.isPending}
                icon={<Sparkles size={18} color="#ffffff" />}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        )}
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
});
