/**
 * Every link the product puts in front of a user outside the app.
 *
 * These are the URLs that decide whether a tap opens the installed app or the
 * website. A path the app does not claim — in apple-app-site-association and in
 * the Android intent filters — is handed to the browser, silently, with nothing
 * in any log to say so. That is how the expiry email's button ended up opening
 * Safari for months.
 *
 * So the builders live here, deliberately free of Deno APIs, and
 * src/lib/appLinks.test.ts checks what they produce against both platforms'
 * claim files on every test run.
 */

// @ts-ignore Deno requires the explicit extension; native tsconfig does not.
import { referralUrl } from "./referralCodes.ts";

/**
 * A referral invite. Not built by an email, but it goes out through a share
 * sheet to someone who may already have the app installed, so it lives or dies
 * by the same claim files as everything else here.
 */
export { referralUrl };

/** Trailing slashes on APP_BASE_URL would otherwise produce `//coupons`. */
export function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Where the expiry email's button lands: straight at the coupon when there is
 * only one, at the list when there are several.
 */
export function couponsUrl(base: string, couponIds: Array<string | number>): string {
  const root = normalizeBase(base);
  return couponIds.length === 1 ? `${root}/coupons/${couponIds[0]}` : `${root}/coupons`;
}

/** The in-app preference centre, reached from the footer of every email. */
export function unsubscribeUrl(base: string, token: string): string {
  return `${normalizeBase(base)}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** The in-app notification list, linked from the push notifications. */
export function notificationsUrl(base: string): string {
  return `${normalizeBase(base)}/notifications`;
}

/** Notification preferences, linked from the settings prompts. */
export function notificationSettingsUrl(base: string): string {
  return `${normalizeBase(base)}/notification-settings`;
}

/** The savings screen, linked from the summary and milestone emails. */
export function statisticsUrl(base: string): string {
  return `${normalizeBase(base)}/statistics`;
}

/** The sharing screen, linked from the "someone shared with you" email. */
export function sharingUrl(base: string): string {
  return `${normalizeBase(base)}/sharing`;
}

/**
 * Where a notification of any kind points.
 *
 * The kinds each carry their own in-app path, and a path that reaches here
 * without a builder above is a path nothing claims — so this refuses anything
 * it does not recognise rather than quietly handing the user to Safari.
 */
export function notificationUrl(base: string, path: string): string {
  const root = normalizeBase(base);
  if (path === "/coupons" || path === "/notifications" || path === "/notification-settings") {
    return `${root}${path}`;
  }
  if (path === "/statistics") return statisticsUrl(base);
  if (path === "/sharing") return sharingUrl(base);
  const coupon = path.match(/^\/coupons\/(\d+)$/);
  if (coupon) return couponsUrl(base, [Number(coupon[1])]);
  return notificationsUrl(base);
}

/**
 * One sample of every link shape above, for the test to check against the
 * claim files. Add a builder, add it here — an unclaimed link is then a failing
 * test rather than a support message.
 */
export function allEmailLinks(base: string): Record<string, string> {
  return {
    "expiry email, one coupon": couponsUrl(base, [42]),
    "expiry email, several coupons": couponsUrl(base, [42, 43]),
    unsubscribe: unsubscribeUrl(base, "sample.token"),
    notifications: notificationsUrl(base),
    "notification settings": notificationSettingsUrl(base),
    statistics: statisticsUrl(base),
    sharing: sharingUrl(base),
    "notification link, coupon": notificationUrl(base, "/coupons/42"),
    "notification link, statistics": notificationUrl(base, "/statistics"),
    "notification link, sharing": notificationUrl(base, "/sharing"),
    "notification link, unknown path": notificationUrl(base, "/somewhere-else"),
    "referral invite": referralUrl(base, "ELIOR"),
  };
}
