import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CelebrationState } from "./celebrationTrigger";

/**
 * What the widget has already celebrated, and the wallet high-water mark.
 *
 * Device-local by design: this is presentation state, not something the server
 * needs, and it must survive being read on every sync without a round trip.
 * Cleared on sign-out (see `clearLocalPrivateData`).
 */
const KEY = "widget_celebrations:v1";

/** A milestone reached long ago is not worth remembering forever. */
const MAX_TOKENS = 40;

type Stored = {
  walletRecord?: number;
  celebrated?: string[];
  /** ISO timestamp of the scene currently on the widget, so it can expire. */
  shownAt?: string;
  shownKind?: string;
  /** A headline fixed when the scene went up (a redemption names its coupon). */
  shownText?: string;
  /** ISO instant the scene comes down. Absent = `shownAt` + `CELEBRATION_TTL_MS`. */
  shownUntil?: string;
};

/** A celebration stays on the widget for a day, then normal service resumes. */
export const CELEBRATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function loadCelebrationMemory(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Stored;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function save(next: Stored): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: the widget still rendered, it may just repeat the scene.
  }
}

/** Folds the stored memory into the shape `pickCelebration` expects. */
export function toCelebrationState(
  stored: Stored,
  memberSince: string | null | undefined
): CelebrationState {
  return {
    memberSince,
    walletRecord: stored.walletRecord ?? null,
    celebrated: stored.celebrated ?? [],
  };
}

/** Headlines are one short widget line; anything longer is not ours. */
const MAX_TEXT_CHARS = 80;

/** When the stored scene comes down, or null when there is no scene. */
export function celebrationEndsAt(stored: Stored): number | null {
  if (!stored.shownAt || !stored.shownKind) return null;
  const until = stored.shownUntil ? Date.parse(stored.shownUntil) : NaN;
  if (Number.isFinite(until)) return until;
  const at = Date.parse(stored.shownAt);
  return Number.isFinite(at) ? at + CELEBRATION_TTL_MS : null;
}

/** True while the stored scene is still up. */
export function isCelebrationFresh(stored: Stored, now = Date.now()): boolean {
  const end = celebrationEndsAt(stored);
  return end !== null && now < end;
}

/**
 * Puts a redemption scene up until `until`. It replaces whatever is showing:
 * the user just did this, so it outranks a milestone reached on its own.
 * No token is kept — every finished coupon deserves its own moment.
 */
export async function rememberRedemption(kind: string, text: string, until: Date): Promise<void> {
  const stored = await loadCelebrationMemory();
  await save({
    ...stored,
    shownAt: new Date().toISOString(),
    shownKind: kind,
    shownText: text.slice(0, MAX_TEXT_CHARS),
    shownUntil: until.toISOString(),
  });
}

/** Records that a scene went up, keeping the token list bounded. */
export async function rememberCelebration(
  stored: Stored,
  kind: string,
  token: string,
  walletValue: number
): Promise<void> {
  const celebrated = [...(stored.celebrated ?? []), token].slice(-MAX_TOKENS);
  await save({
    celebrated,
    walletRecord: Math.max(stored.walletRecord ?? 0, walletValue),
    shownAt: new Date().toISOString(),
    shownKind: kind,
  });
}

/** Keeps the wallet high-water mark current even when nothing is celebrated. */
export async function noteWalletValue(stored: Stored, walletValue: number): Promise<void> {
  if (walletValue <= (stored.walletRecord ?? 0)) return;
  await save({ ...stored, walletRecord: walletValue });
}

export type { Stored as CelebrationMemory };
