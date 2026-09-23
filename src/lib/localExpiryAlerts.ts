import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { isSpendableCoupon, couponRemainingValue } from "@/lib/couponTotals";
import { DAILY_REMINDER_DAYS } from "@/lib/notificationWindows";
import {
  ANDROID_CHANNEL_ID,
  ensureAndroidChannel,
  getNativePushState,
} from "@/lib/nativeNotifications";
import { expiryFaceAttachment } from "./notificationFaces";
import { rtlText } from "./rtlText";

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

/**
 * Hash of the last plan we scheduled, to skip re-scheduling an identical one.
 * v2: reminders now carry Kuponi's face, so plans scheduled without it are redone.
 */
const PLAN_KEY = "local-expiry:plan:v2";

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

/** One coupon's share of a reminder. */
type PlannedCoupon = {
  couponId: number;
  company: string;
  daysLeft: number;
};

/**
 * One banner, at one moment, for every coupon that moment is about.
 *
 * The grouping is the whole point. A wallet with two coupons expiring on
 * different dates used to raise two separate banners at the same minute, one
 * naming each, and with the daily reminder switched on it did that again every
 * morning — six notifications over three days to say the same two things. The
 * phone has no more right to interrupt twice than the server does, and the
 * server has always sent one digest per run.
 */
type PlannedAlert = {
  at: number;
  coupons: PlannedCoupon[];
};

function alertDate(expiration: string, daysBefore: number): number | null {
  const expiry = new Date(expiration);
  if (Number.isNaN(expiry.getTime())) return null;
  const at = new Date(expiry);
  at.setDate(at.getDate() - daysBefore);
  at.setHours(ALERT_HOUR, 0, 0, 0);
  return at.getTime();
}

function whenLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "היום";
  if (daysLeft === 1) return "מחר";
  return `בעוד ${daysLeft} ימים`;
}

function money(remaining: number): string {
  return remaining > 0 ? ` (נותרו \u2066₪\u00A0${remaining.toLocaleString("he-IL")}\u2069)` : "";
}

/**
 * What the banner says. One coupon keeps the sentence it always had; more than
 * one is counted rather than listed, because a lock-screen banner truncates and
 * the count is the part that decides whether to open the app.
 *
 * A group can hold different deadlines — a coupon on its expiry day and another
 * at its week-before mark fall on the same morning — so the soonest one leads,
 * and the total is what is actually at stake.
 */
function body(coupons: PlannedCoupon[], remainingById: Map<number, number>): string {
  const total = coupons.reduce((sum, c) => sum + (remainingById.get(c.couponId) ?? 0), 0);
  const soonest = Math.min(...coupons.map((c) => c.daysLeft));
  if (coupons.length === 1) {
    return `הקופון של ${coupons[0].company} פג ${whenLabel(soonest)}${money(total)}.`;
  }
  const sameDay = coupons.every((c) => c.daysLeft === soonest);
  return sameDay
    ? `${coupons.length} קופונים פגים ${whenLabel(soonest)}${money(total)}.`
    : `${coupons.length} קופונים פגים בקרוב, הראשון ${whenLabel(soonest)}${money(total)}.`;
}

/**
 * Every reminder the preferences call for, soonest first, one per moment, and
 * trimmed to what the platform will actually hold.
 *
 * The cap counts banners, not coupons, which is the other half of the grouping:
 * a ten-coupon wallet on a daily reminder used to spend the entire budget
 * inside a week and then go silent, because every coupon took a slot of its
 * own on every one of those mornings.
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
  const byMoment = new Map<number, PlannedCoupon[]>();

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
      const list = byMoment.get(at) || [];
      list.push({ couponId: coupon.id, company: coupon.company, daysLeft: daysBefore });
      byMoment.set(at, list);
    }
  }

  return [...byMoment.entries()]
    .map(([at, list]) => ({ at, coupons: list.sort((a, b) => a.daysLeft - b.daysLeft) }))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SCHEDULED);
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
async function syncLocalExpiryAlertsNow(
  coupons: DecryptedCoupon[],
  prefs: Prefs,
): Promise<void> {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  // The server sends the same reminders by push, from send-expiry-alerts, and
  // says them better: written per message, and held back during quiet hours.
  // Two banners for one coupon is the worst of both, so these stay a fallback —
  // for a device with no push registration, and for the build that cannot have
  // one at all (see the note at the top of this file).
  const push = await getNativePushState().catch(() => null);
  if (!push || push.subscribed) {
    await clearLocalExpiryAlertsNow();
    return;
  }

  const planned = planExpiryAlerts(coupons, prefs);
  const remainingById = new Map(coupons.map((c) => [c.id, couponRemainingValue(c)]));

  const fingerprint = JSON.stringify(
    planned.map((alert) => [alert.at, alert.coupons.map((c) => [c.couponId, c.daysLeft])]),
  );
  if ((await AsyncStorage.getItem(PLAN_KEY).catch(() => null)) === fingerprint) return;

  await ensureAndroidChannel();
  await cancelOurs();

  for (const alert of planned) {
    const single = alert.coupons.length === 1 ? alert.coupons[0] : null;
    // The soonest deadline leads the sentence, so it picks the face too.
    const attachments = await expiryFaceAttachment(alert.coupons[0].daysLeft);
    await Notifications.scheduleNotificationAsync({
      content: {
        ...(attachments ? { attachments } : {}),
        title: rtlText(single ? "קופון עומד לפוג" : "קופונים עומדים לפוג"),
        body: rtlText(body(alert.coupons, remainingById)),
        // A digest has no single coupon to open, so it lands on the list.
        data: single
          ? { kind: KIND, couponId: single.couponId }
          : { kind: KIND, couponIds: alert.coupons.map((c) => c.couponId) },
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
async function clearLocalExpiryAlertsNow(): Promise<void> {
  await cancelOurs().catch(() => {});
  await AsyncStorage.removeItem(PLAN_KEY).catch(() => {});
}

// Serialize wallet changes and push registration cleanup so an older sync
// cannot schedule local reminders after registration has cancelled them.
let pending: Promise<void> = Promise.resolve();
function enqueue(operation: () => Promise<void>): Promise<void> {
  const result = pending.then(operation);
  pending = result.catch(() => {});
  return result;
}

export function syncLocalExpiryAlerts(coupons: DecryptedCoupon[], prefs: Prefs): Promise<void> {
  return enqueue(() => syncLocalExpiryAlertsNow(coupons, prefs));
}

export function clearLocalExpiryAlerts(): Promise<void> {
  return enqueue(clearLocalExpiryAlertsNow);
}
