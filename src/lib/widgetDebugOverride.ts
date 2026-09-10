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

export async function loadWidgetDebugOverride(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export async function setWidgetDebugOverride(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, token);
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
