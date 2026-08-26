/**
 * Every link an email puts in front of a user.
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

/** Trailing slashes on APP_BASE_URL would otherwise produce `//coupons`. */
export function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Where the expiry email's button lands: straight at the coupon when there is
 * only one, at the list when there are several.
 */
export function couponsUrl(base: string, couponIds: number[]): string {
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
  };
}
