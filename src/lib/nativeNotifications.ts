import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "@/integrations/supabase/client";

const ANDROID_CHANNEL_ID = "expiry-alerts";

/**
 * Without a handler, a notification that arrives while the app is open is
 * delivered silently — no banner, no sound. Registered at module load so it is
 * in place before the first push can land.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Android shows nothing as a heads-up until a channel exists. */
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "תזכורות תפוגה",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/**
 * expo-notifications resolves the EAS project id from the manifest, which is
 * absent in some bare/dev-client builds. Pass it explicitly when we have it.
 */
/**
 * Turn a push-registration failure into something a person can read.
 *
 * These arrive from Apple's own frameworks, in English, phrased for whoever
 * wrote the build — "no valid aps-environment entitlement string found" is a
 * true and completely useless thing to show somebody who tapped "remind me".
 */
function describeTokenFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("aps-environment")) {
    return "הגרסה הזאת של האפליקציה נבנתה בלי הרשאת Push. צריך build חדש כדי להפעיל התראות.";
  }
  if (raw.includes("projectId") || raw.includes("project ID")) {
    return "חסר מזהה פרויקט להתראות בגרסה הזאת של האפליקציה.";
  }
  if (/network|timeout|offline/i.test(raw)) {
    return "אין חיבור לשרת ההתראות. נסו שוב עוד רגע.";
  }
  return "לא הצלחנו לרשום את המכשיר לקבלת התראות.";
}

async function fetchExpoToken(): Promise<string | null> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;
  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data || null;
  } catch (error) {
    throw new Error(describeTokenFailure(error));
  }
}

type NativePushState = {
  supported: boolean;
  permission: "granted" | "denied" | "undetermined";
  subscribed: boolean;
  expoToken?: string | null;
};

async function invokePushFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("push-notifications", { body });
  if (error) throw new Error(error.message || "שירות ה-Push לא זמין כרגע.");
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export function isNativePushSupported() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export async function getNativePushState(): Promise<NativePushState> {
  if (!isNativePushSupported()) {
    return { supported: false, permission: "undetermined", subscribed: false };
  }

  const settings = await Notifications.getPermissionsAsync();
  let expoToken: string | null = null;

  if (settings.status === "granted") {
    try {
      expoToken = await fetchExpoToken();
    } catch {
      expoToken = null;
    }
  }

  return {
    supported: true,
    permission:
      settings.status === "granted"
        ? "granted"
        : settings.status === "denied"
          ? "denied"
          : "undetermined",
    subscribed: Boolean(expoToken),
    expoToken,
  };
}

export async function subscribeToNativePush() {
  if (!isNativePushSupported()) {
    throw new Error("התראות Push נייטיביות נתמכות רק ב-iOS או Android.");
  }

  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== "granted") {
      throw new Error("לא ניתנה הרשאה להתראות.");
    }
  }

  await ensureAndroidChannel();

  const expoToken = await fetchExpoToken();
  if (!expoToken) {
    throw new Error("לא התקבל token של Expo.");
  }

  // The account comes from the caller's JWT on the server; nothing about the
  // identity is taken from this body.
  await invokePushFunction({
    action: "subscribe-expo",
    expo_token: expoToken,
    platform: Platform.OS,
  });

  return expoToken;
}

export async function unsubscribeFromNativePush() {
  if (!isNativePushSupported()) return;

  // Revoking the OS permission makes the token unreadable. Turning the switch
  // off must still work in that state, so a failure here is not fatal.
  let expoToken: string | null = null;
  try {
    expoToken = await fetchExpoToken();
  } catch {
    return;
  }
  if (!expoToken) return;

  await invokePushFunction({ action: "unsubscribe-expo", expo_token: expoToken });
}

export async function sendTestNativePush() {
  if (!isNativePushSupported()) {
    throw new Error("התראות Push נייטיביות נתמכות רק ב-iOS או Android.");
  }
  await invokePushFunction({
    action: "test-user",
    payload: {
      title: "קופון מאסטר",
      body: "זוהי התראת בדיקה. מערכת ה-Push פעילה.",
      url: "/notifications",
      tag: "coupon-master-test",
    },
  });
}
