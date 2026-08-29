import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { isSpendableCoupon, couponRemainingValue } from "@/lib/couponTotals";
import { DAILY_REMINDER_DAYS } from "@/lib/notificationWindows";
import { ANDROID_CHANNEL_ID, ensureAndroidChannel } from "@/lib/nativeNotifications";

/**
 * Expiry reminders scheduled on the device itself, with no server and no push.
 *
 * The wallet already knows every expiry date, so the phone can raise these
 * alone. That matters beyond redundancy: remote push needs the `aps-environment`
 * entitlement, which a free Apple developer team cannot sign — see
 * docs/ios-entitlements-disabled.md. These reminders work regardless.
 */

/** Marks the notifications this module owns, so it never cancels someone else's. */
const KIND = "local-expiry";

/** Hash of the last plan we scheduled, to skip re-scheduling an identical one. */
const PLAN_KEY = "local-expiry:plan:v1";

/**
 * iOS keeps at most 64 pending local notifications per app and silently drops
 * the rest, so the budget is spent deliberately: soonest first. A couple of
 * slots are left over for other features that schedule locally.
 */
const MAX_SCHEDULED = 56;

/** Local hour reminders fire at. Late enough to not wake anyone, early enough to act on. */
const ALERT_HOUR = 9;

type Prefs = {
  windows: number[];
  daily_within: number | null;
  quiet_until: string | null;
};

type PlannedAlert = {
  at: number;
  couponId: number;
  company: string;
  daysLeft: number;
};

function alertDate(expiration: string, daysBefore: number): number | null {
  const expiry = new Date(expiration);
  if (Number.isNaN(expiry.getTime())) return null;
  const at = new Date(expiry);
  at.setDate(at.getDate() - daysBefore);
  at.setHours(ALERT_HOUR, 0, 0, 0);
  return at.getTime();
}

function body(company: string, daysLeft: number, remaining: number): string {
  const value = remaining > 0 ? ` (נותרו ₪${remaining.toLocaleString("he-IL")})` : "";
  if (daysLeft <= 0) return `הקופון של ${company} פג היום${value}.`;
  if (daysLeft === 1) return `הקופון של ${company} פג מחר${value}.`;
  return `הקופון של ${company} פג בעוד ${daysLeft} ימים${value}.`;
}

/**
 * Every reminder the preferences call for, soonest first and trimmed to what
 * the platform will actually hold.
 */
export function planExpiryAlerts(
  coupons: DecryptedCoupon[],
  prefs: Prefs,
  now: number = Date.now(),
): PlannedAlert[] {
  const quietUntil = prefs.quiet_until ? Date.parse(prefs.quiet_until) : 0;
  const floor = Math.max(now, Number.isNaN(quietUntil) ? 0 : quietUntil);

  // A window and the daily reminder can both land on the same day for the same
  // coupon; keyed here so the user is told once, not twice.
  const seen = new Set<string>();
  const planned: PlannedAlert[] = [];

  for (const coupon of coupons) {
    if (!coupon.expiration || !isSpendableCoupon(coupon)) continue;

    const dailyDays = prefs.daily_within
      ? Array.from(
          { length: Math.min(prefs.daily_within, DAILY_REMINDER_DAYS) + 1 },
          (_, day) => day,
        )
      : [];

    for (const daysBefore of [...prefs.windows, ...dailyDays]) {
      const at = alertDate(coupon.expiration, daysBefore);
      if (at === null || at <= floor) continue;
      const key = `${coupon.id}:${daysBefore}`;
      if (seen.has(key)) continue;
      seen.add(key);
      planned.push({ at, couponId: coupon.id, company: coupon.company, daysLeft: daysBefore });
    }
  }

  return planned.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}

/** Cancels only what this module scheduled, leaving other features' alerts alone. */
async function cancelOurs(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((item) => (item.content.data as { kind?: string } | null)?.kind === KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

/**
 * Brings the device's scheduled reminders in line with the current wallet.
 *
 * Cheap to call on every wallet change: an unchanged plan is detected by hash
 * and costs one storage read, not 50 cancel-and-reschedule round trips.
 */
export async function syncLocalExpiryAlerts(
  coupons: DecryptedCoupon[],
  prefs: Prefs,
): Promise<void> {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  const planned = planExpiryAlerts(coupons, prefs);
  const remainingById = new Map(coupons.map((c) => [c.id, couponRemainingValue(c)]));

  const fingerprint = JSON.stringify(
    planned.map((alert) => [alert.couponId, alert.at, alert.daysLeft]),
  );
  if ((await AsyncStorage.getItem(PLAN_KEY).catch(() => null)) === fingerprint) return;

  await ensureAndroidChannel();
  await cancelOurs();

  for (const alert of planned) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "קופון עומד לפוג",
        body: body(alert.company, alert.daysLeft, remainingById.get(alert.couponId) ?? 0),
        data: { kind: KIND, couponId: alert.couponId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(alert.at),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }

  await AsyncStorage.setItem(PLAN_KEY, fingerprint).catch(() => {});
}

/** Clears every reminder this module owns. Called on sign-out. */
export async function clearLocalExpiryAlerts(): Promise<void> {
  await cancelOurs().catch(() => {});
  await AsyncStorage.removeItem(PLAN_KEY).catch(() => {});
}
