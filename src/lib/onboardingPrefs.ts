import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * What the walkthrough learned about the person before it showed them any
 * value. The answers are not used to gate anything — they exist so the copy
 * further in can name the problem the user just told us they have, which is
 * what turns a form into a conversation.
 */
export type OnboardingGoal = "expiry" | "lost" | "sell";
export type OnboardingVolume = "few" | "some" | "many";

export type OnboardingPrefs = {
  goal?: OnboardingGoal;
  volume?: OnboardingVolume;
};

const PREFIX = "onboarding_prefs:";
const PUSH_NUDGE_PREFIX = "push_nudge_dismissed:";

function key(prefix: string, identity?: string | null) {
  return `${prefix}${identity?.trim().toLowerCase() || "guest"}`;
}

export async function saveOnboardingPrefs(identity: string | null | undefined, prefs: OnboardingPrefs): Promise<void> {
  try {
    const current = await getOnboardingPrefs(identity);
    await AsyncStorage.setItem(key(PREFIX, identity), JSON.stringify({ ...current, ...prefs }));
  } catch {
    // Best-effort. Losing a preference must never block the walkthrough.
  }
}

export async function getOnboardingPrefs(identity?: string | null): Promise<OnboardingPrefs> {
  try {
    const raw = await AsyncStorage.getItem(key(PREFIX, identity));
    return raw ? (JSON.parse(raw) as OnboardingPrefs) : {};
  } catch {
    return {};
  }
}

export async function hasDismissedPushNudge(identity?: string | null): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(PUSH_NUDGE_PREFIX, identity))) === "true";
  } catch {
    return true; // On a storage failure, stay quiet rather than nag every launch.
  }
}

export async function dismissPushNudge(identity?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(key(PUSH_NUDGE_PREFIX, identity), "true");
  } catch {
    // Best-effort.
  }
}

/** The volume answer, turned into the number the summary counts up to. */
export function estimateAnnualSavings(volume: OnboardingVolume | undefined, savedNow: number): number {
  const perMonth = volume === "many" ? 6 : volume === "some" ? 3 : 1;
  const perCoupon = savedNow > 0 ? savedNow : 25;
  return Math.round(perCoupon * perMonth * 12);
}

const PUSH_PRIMER_PREFIX = "push_primer_seen:";

/**
 * Whether this person has already been asked, in our own words, about
 * notifications. Separate from the nudge banner's flag: the primer is the one
 * warm ask that precedes the OS dialog, and it gets exactly one showing.
 */
export async function hasSeenPushPrimer(identity?: string | null): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(PUSH_PRIMER_PREFIX, identity))) === "true";
  } catch {
    return true; // On a storage failure, stay quiet rather than ask every launch.
  }
}

export async function markPushPrimerSeen(identity?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(key(PUSH_PRIMER_PREFIX, identity), "true");
  } catch {
    // Best-effort.
  }
}
