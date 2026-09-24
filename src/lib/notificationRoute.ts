/**
 * Where a notification leads, read off the data it carried.
 *
 * Server pushes carry `url`, the same in-app path the notification row stores
 * (see copyFor in supabase/functions/_shared/notificationTypes.ts). The phone's
 * own expiry reminders carry `couponId` or `couponIds` instead. Only an in-app
 * path is ever followed: `url` crosses the network, and a tap must not be able
 * to send anyone somewhere the app did not mean.
 */
export function routeForNotification(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const fields = data as Record<string, unknown>;

  if (typeof fields.url === "string") {
    const url = fields.url.trim();
    return url.startsWith("/") && !url.startsWith("//") ? url : null;
  }
  if (typeof fields.couponId === "number" || typeof fields.couponId === "string") {
    return `/coupons/${encodeURIComponent(String(fields.couponId))}`;
  }
  if (Array.isArray(fields.couponIds)) return "/coupons";
  return null;
}

/** The Kuponi face a push asked for, when it asked for one we have drawn. */
export const NOTIFICATION_FACE_KEYS = [
  "expiry-week",
  "expiry-soon",
  "expiry-tomorrow",
  "expiry-today",
  "idle-money",
  "share-received",
  "balance-updated",
  "coupon-finished",
  "coupon-milestone",
  "monthly-summary",
  "expired-unused",
  "default",
] as const;

export type NotificationFaceKey = (typeof NOTIFICATION_FACE_KEYS)[number];

export function faceKeyForNotification(data: unknown): NotificationFaceKey {
  const key = data && typeof data === "object" ? (data as Record<string, unknown>).iconKey : undefined;
  return (NOTIFICATION_FACE_KEYS as readonly string[]).includes(key as string)
    ? (key as NotificationFaceKey)
    : "default";
}
