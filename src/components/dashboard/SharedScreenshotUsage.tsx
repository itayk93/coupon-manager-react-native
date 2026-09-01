import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ReceiptText, TicketPlus } from "lucide-react-native";
import { completeSharedImport, peekSharedImport, SharedUsageImport } from "coupon-widget";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useParseCoupon } from "@/hooks/useCouponAI";
import { useCoupons } from "@/hooks/useCoupons";
import { fonts } from "@/lib/theme";
import { storeSharedCouponImport } from "@/lib/sharedCouponImport";

/**
 * Mounted once at the root. When the user shares a screenshot into the app from
 * another app's share sheet, the native side leaves the image waiting; this
 * picks it up and lets the user choose between adding a coupon and reporting
 * usage on an existing coupon.
 *
 * The image is polled on foreground rather than delivered by a deep link
 * because Android hands it over as an ACTION_SEND intent, which is not a link
 * at all — one path serves both platforms.
 */
export function SharedScreenshotUsage() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const { data: coupons = [], isLoading: couponsLoading } = useCoupons();
  const parseCoupon = useParseCoupon();
  const [pendingImport, setPendingImport] = useState<SharedUsageImport | null>(null);
  const [mode, setMode] = useState<"choose" | "usage" | "add" | null>(null);

  useEffect(() => {
    if (!user) return;

    const check = () => {
      const pending = peekSharedImport();
      if (pending) {
        setPendingImport(pending);
        setMode(pending.mode === "add" || pending.mode === "usage" ? pending.mode : "choose");
      }
    };

    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [user, coupons.length]);

  const closeImport = () => {
    completeSharedImport();
    setPendingImport(null);
    setMode(null);
  };

  const addCouponFromImage = async () => {
    if (!pendingImport || parseCoupon.isPending) return;

    try {
      const [parsed] = await parseCoupon.mutateAsync({
        imageBase64: pendingImport.imageBase64,
        text: pendingImport.text,
        companyNames: coupons.map((coupon) => coupon.company),
      });

      completeSharedImport();
      setPendingImport(null);
      setMode(null);
      storeSharedCouponImport(pendingImport.id, parsed);
      router.push({
        pathname: "/coupons/add",
        params: {
          initialImportId: pendingImport.id,
          returnToPrevious: "1",
        },
      });
    } catch (e) {
      console.error(e);
      setMode("choose");
    }
  };

  useEffect(() => {
    if (mode === "add") void addCouponFromImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pendingImport?.id]);

  if (!pendingImport || couponsLoading) return null;

  if (mode === "choose") {
    return (
      <Modal
        visible
        onClose={closeImport}
        title={`מה לעשות עם ה${pendingImport.text ? "הודעה" : "תמונה"}?`}
        subtitle="אפשר להוסיף קופון חדש או לדווח שימוש בקופון קיים"
      >
        <View style={styles.choiceContainer}>
          {parseCoupon.isPending ? (
            <View style={[styles.processing, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.processingText, { color: theme.textMuted }]}>
                מזהים את פרטי הקופון...
              </Text>
            </View>
          ) : null}
          <Button
            title="הוספת קופון חדש"
            onPress={addCouponFromImage}
            loading={parseCoupon.isPending}
            disabled={parseCoupon.isPending}
            icon={<TicketPlus size={20} color="#ffffff" />}
          />
          <Button
            title="סימון שימוש בקופון"
            onPress={() => setMode("usage")}
            variant="outline"
            disabled={parseCoupon.isPending}
            icon={<ReceiptText size={20} color={theme.primary} />}
          />
        </View>
      </Modal>
    );
  }

  if (mode === "add") {
    return (
      <Modal
        visible
        onClose={closeImport}
        title="מוסיף קופון מהתמונה"
        subtitle="מזהים את הפרטים ומכינים טופס חדש"
      >
        <View style={[styles.processing, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.processingText, { color: theme.textMuted }]}>
            מזהים את פרטי הקופון...
          </Text>
        </View>
      </Modal>
    );
  }

  if (mode !== "usage") return null;

  return (
    <QuickUsageModal
      visible
      onClose={closeImport}
      coupons={coupons}
      initialScreenshotBase64={pendingImport.imageBase64!}
      importId={pendingImport.id}
      onImportPaused={() => {
        setPendingImport(null);
        setMode(null);
      }}
      onImportCompleted={() => {
        completeSharedImport();
        setPendingImport(null);
        setMode(null);
      }}
    />
  );
}

const styles = StyleSheet.create({
  choiceContainer: {
    gap: 12,
    paddingVertical: 4,
  },
  processing: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 4,
    padding: 16,
  },
  processingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
});
