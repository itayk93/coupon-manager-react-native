import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "onboarding_completed:";

function key(identity?: string | null) {
  return `${PREFIX}${identity?.trim().toLowerCase() || "guest"}`;
}

export async function hasCompletedOnboarding(identity?: string | null): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(identity))) === "true";
  } catch {
    return false;
  }
}

export async function setOnboardingCompleted(identity?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(key(identity), "true");
  } catch {
    // Best-effort. A storage failure should not block entry to the app.
  }
}
