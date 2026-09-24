import type { ImageSourcePropType } from "react-native";
import type { NotificationFaceKey } from "./notificationRoute";

/**
 * The Kuponi faces as bundled images, for a push shown inside the app.
 *
 * The same 256px drawings the PWA serves and the server names in `iconKey`
 * (supabase/functions/_shared/notificationIcons.ts), so a push reads the same
 * on the lock screen and in the island.
 */
export const NOTIFICATION_FACE_IMAGES: Record<NotificationFaceKey, ImageSourcePropType> = {
  "expiry-week": require("../../public/notification-icons/expiry-week.png"),
  "expiry-soon": require("../../public/notification-icons/expiry-soon.png"),
  "expiry-tomorrow": require("../../public/notification-icons/expiry-tomorrow.png"),
  "expiry-today": require("../../public/notification-icons/expiry-today.png"),
  "idle-money": require("../../public/notification-icons/idle-money.png"),
  "share-received": require("../../public/notification-icons/share-received.png"),
  "balance-updated": require("../../public/notification-icons/balance-updated.png"),
  "coupon-finished": require("../../public/notification-icons/coupon-finished.png"),
  "coupon-milestone": require("../../public/notification-icons/coupon-milestone.png"),
  "monthly-summary": require("../../public/notification-icons/monthly-summary.png"),
  "expired-unused": require("../../public/notification-icons/expired-unused.png"),
  default: require("../../public/notification-icons/default.png"),
};
