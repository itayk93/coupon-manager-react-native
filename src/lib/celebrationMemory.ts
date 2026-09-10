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

/** True while the scene written at `shownAt` is still inside its day. */
export function isCelebrationFresh(stored: Stored, now = Date.now()): boolean {
  if (!stored.shownAt || !stored.shownKind) return false;
  const at = Date.parse(stored.shownAt);
  return Number.isFinite(at) && now - at < CELEBRATION_TTL_MS;
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
