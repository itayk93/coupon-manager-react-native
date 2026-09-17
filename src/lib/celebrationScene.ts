import { baselineCelebrationTokens, pickCelebration, pickSixSevenCelebration } from "./celebrationTrigger";
import { totalRealizedSavings } from "./couponSavings";
import {
  celebrationEndsAt,
  isCelebrationFresh,
  loadCelebrationMemory,
  nextLocalMidnight,
  noteWalletValue,
  rememberCelebration,
  seedCelebrationBaseline,
  toCelebrationState,
} from "./celebrationMemory";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { isSpendableCoupon, totalRemainingValue } from "@/lib/couponTotals";

/**
 * Which celebration is running right now, for everyone who draws one.
 *
 * This used to live inside `widgetSync`, which made the widget the only place
 * a scene could appear: ten scenes were produced, tested on device and wired
 * into both native widgets, and a user who never added a widget saw none of
 * them, ever. The decision belongs here instead, and the widget and the app
 * both read it, so they can never disagree about what is being celebrated.
 */

export type CelebrationScene = { kind: string; text: string; until: string | null };

const shekels = (value: number) => `₪${Math.round(value).toLocaleString("en-US")}`;

/**
 * The concrete sentence a celebration scene shows.
 *
 * A scene title has to name the achievement — "אבן דרך חדשה" tells the user
 * nothing, "25 קופונים בארנק" does. The numbers come from the wallet the widget
 * already has, so the headline can never disagree with the app.
 */
export function celebrationHeadline(kind: string, coupons: DecryptedCoupon[]): string {
  const spendable = coupons.filter(isSpendableCoupon);
  const walletValue = totalRemainingValue(coupons);
  // Same figure as the statistics screen: saved on what was actually spent.
  const lifetimeSavings = totalRealizedSavings(coupons);
  const redeemed = coupons.filter((coupon) => coupon.status === "נוצל").length;

  switch (kind) {
    case "six-seven":
      return "67 קופונים!";
    // Real redemptions carry their own headline (see `redemptionCelebration`);
    // this only feeds the debug preview.
    case "redeemed":
      return `מימשת את ${spendable[0]?.company || "BuyMe"}\nחסכת 100 ש״ח`;
    case "anniversary":
      return "שנה ביחד! 🎉";
    case "milestone":
      return `${spendable.length} קופונים בארנק!`;
    case "savings":
      return `חסכת ${shekels(lifetimeSavings)} עד היום`;
    // TODO: monthly/streak have no field of their own yet — these read off the
    // wallet so the scene is at least testable, and get real numbers when the
    // triggers land.
    case "monthly":
      return `החודש חסכת ${shekels(lifetimeSavings / 12)}`;
    case "streak":
      return "3 שבועות ברצף של חיסכון";
    case "rescue":
      return `מימשת ${shekels(walletValue / Math.max(spendable.length, 1))} יום לפני שפג`;
    case "clean":
      return "0 קופונים פגו החודש";
    case "referral":
      return "חבר הצטרף בזכותך!";
    case "record":
      // Two lines on purpose; "ש״ח" instead of "₪" because the sign mis-orders
      // next to digits in the RTL widget.
      return `שיא חדש!\n${Math.round(walletValue).toLocaleString("en-US")} ש״ח בארנק`;
    default:
      return `${redeemed} קופונים מומשו`;
  }
}

/**
 * A milestone worth showing, or null.
 *
 * A coupon about to expire always wins: nudging the user to spend before they
 * lose money matters more than a pat on the back, and showing both at once is
 * not an option on a small widget.
 */
async function pickScene(
  coupons: DecryptedCoupon[],
  memberSince: string | null | undefined,
  urgentDays: number | null
): Promise<{ kind: string; text: string; until: string | null } | null> {
  if (urgentDays !== null && urgentDays <= 2) return null;

  const stored = await loadCelebrationMemory();
  const walletValue = totalRemainingValue(coupons);

  // The exact 67-count moment must not be swallowed by yesterday's record or
  // a routine milestone. Urgent expiry and fresh redemption keep priority.
  const special = pickSixSevenCelebration(coupons, toCelebrationState(stored, memberSince));
  const redemptionFresh = isCelebrationFresh(stored) && (stored.shownKind === "redeemed" || stored.shownKind === "rescue");
  if (special && !redemptionFresh) {
    const until = nextLocalMidnight();
    await rememberCelebration(stored, special.kind, special.token, walletValue, until);
    return { kind: special.kind, text: "67 קופונים!", until: until.toISOString() };
  }

  // A scene stays up until it ends rather than vanishing on the next sync.
  if (isCelebrationFresh(stored) && stored.shownKind) {
    const end = celebrationEndsAt(stored);
    return {
      kind: stored.shownKind,
      text: stored.shownText || celebrationHeadline(stored.shownKind, coupons),
      until: end === null ? null : new Date(end).toISOString(),
    };
  }

  // No record yet means this wallet was never seen here: take it as the baseline
  // instead of celebrating steps it reached long ago.
  const memory =
    stored.walletRecord == null && walletValue > 0
      ? await seedCelebrationBaseline(stored, walletValue, baselineCelebrationTokens(coupons))
      : stored;
  const pick = pickCelebration(coupons, toCelebrationState(memory, memberSince));
  if (!pick) {
    await noteWalletValue(memory, walletValue);
    return null;
  }

  const until = nextLocalMidnight();
  await rememberCelebration(memory, pick.kind, pick.token, walletValue, until);
  return {
    kind: pick.kind,
    text: celebrationHeadline(pick.kind, coupons),
    until: until.toISOString(),
  };
}


/**
 * The running scene, picking one if nothing is up.
 *
 * Single-flight: the widget sync and the app both ask, often on the same tick,
 * and `pickScene` reads storage before it writes. Sharing one in-flight promise
 * means the second caller gets the same answer instead of consuming a second
 * milestone token.
 */
let inFlight: Promise<CelebrationScene | null> | null = null;

export function currentCelebration(
  coupons: DecryptedCoupon[],
  memberSince: string | null | undefined,
  urgentDays: number | null
): Promise<CelebrationScene | null> {
  if (inFlight) return inFlight;
  inFlight = pickScene(coupons, memberSince, urgentDays).finally(() => { inFlight = null; });
  return inFlight;
}
