import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Admin-only. A forced home-screen widget scene that wins over real coupon
 * data, so the widget can be eyeballed on a device in any scene regardless of
 * what is actually expiring.
 *
 * The token is either a digit string "1".."9" (an expiry mascot scene) or a
 * celebration key such as "anniversary". Cleared from the widget settings
 * screen or on sign-out (see `clearLocalPrivateData`).
 */
const KEY = "widget_debug_state";

/** A forgotten override must not hide real expiring coupons for days. */
const MAX_AGE_MS = 30 * 60 * 1000;

export async function loadWidgetDebugOverride(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const [token, at] = raw.split("@");
    if (!token || !(Date.now() - Number(at) < MAX_AGE_MS)) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export async function setWidgetDebugOverride(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, `${token}@${Date.now()}`);
  } catch {
    // Non-fatal: the widget was already updated in memory for this session.
  }
}

export async function clearWidgetDebugOverride(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Non-fatal.
  }
}
