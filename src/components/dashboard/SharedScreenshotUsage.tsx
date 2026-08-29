import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { consumeSharedImage } from "coupon-widget";
import { QuickUsageModal } from "@/components/dashboard/QuickUsageModal";
import { useAuth } from "@/contexts/AuthContext";
import { useCoupons } from "@/hooks/useCoupons";

/**
 * Mounted once at the root. When the user shares a screenshot into the app from
 * another app's share sheet, the native side leaves the image waiting; this
 * picks it up and opens the usage flow with AI detection already running.
 *
 * The image is polled on foreground rather than delivered by a deep link
 * because Android hands it over as an ACTION_SEND intent, which is not a link
 * at all — one path serves both platforms.
 */
export function SharedScreenshotUsage() {
  const { user } = useAuth();
  const { data: coupons = [] } = useCoupons();
  const [screenshot, setScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const check = () => {
      const pending = consumeSharedImage();
      if (pending) setScreenshot(pending);
    };

    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [user]);

  if (!screenshot) return null;

  return (
    <QuickUsageModal
      visible
      onClose={() => setScreenshot(null)}
      coupons={coupons}
      initialScreenshotBase64={screenshot}
    />
  );
}
