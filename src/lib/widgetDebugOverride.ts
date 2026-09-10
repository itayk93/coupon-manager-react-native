import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Admin-only. A forced home-screen widget state that wins over real coupon
 * data, so the widget can be eyeballed on a device in any scene regardless of
 * what is actually expiring. Cleared from the widget settings screen or on
 * sign-out (see `clearLocalPrivateData`).
 */
const KEY = "widget_debug_state";

export async function loadWidgetDebugOverride(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function setWidgetDebugOverride(state: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(state));
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
