// The catalogue of things the app can tell someone, and how it says them.
//
// Every string a user reads is written here rather than at the call site, so
// the voice stays one voice: short, warm, and specific about what happened and
// what it is worth. Hebrew throughout, with the amount always carrying its own
// shekel sign — bidi puts the sign on the correct side only when it is glued
// to the number.
//
// Mirrored by src/lib/notificationTypes.ts, which the settings screen reads for
// labels and defaults. An edge function cannot import from src/, so the two are
// kept in step by hand — ids and default channels especially.

export type NotificationChannel = 'email' | 'push' | 'in_app';

export type NotificationTypeId =
  | 'expiry'
  | 'monthly_summary'
  | 'idle_money'
  | 'share_received'
  | 'balance_updated'
  | 'coupon_finished'
  | 'savings_milestone'
  | 'coupon_milestone'
  | 'expired_unused'
  | 'nearby_store';

export type NotificationTypeMeta = {
  id: NotificationTypeId;
  /** Shown in the settings list. */
  label: string;
  /** Defaults per channel when the user has expressed no preference. */
  defaults: Record<NotificationChannel, boolean>;
};

/**
 * Defaults are chosen so that a fresh account is useful and never noisy.
 *
 * Push is on only where the message is worth a buzz in someone's pocket: money
 * about to be lost, something that just happened to them, or a win. The monthly
 * summary and the milestones are pleasant, not urgent — they arrive in the app
 * and by email. `expired_unused` is off by push on purpose: it is the one
 * message that carries bad news, and bad news should not vibrate.
 */
export const NOTIFICATION_TYPES: Record<NotificationTypeId, NotificationTypeMeta> = {
  expiry: {
    id: 'expiry',
    label: 'רגע לפני שקופון פג',
    defaults: { email: true, push: true, in_app: true },
  },
  monthly_summary: {
    id: 'monthly_summary',
    label: 'החודש שלך במספרים',
    defaults: { email: true, push: false, in_app: true },
  },
  idle_money: {
    id: 'idle_money',
    label: 'יתרה שמחכה למימוש',
    defaults: { email: true, push: true, in_app: true },
  },
  share_received: {
    id: 'share_received',
    label: 'קופון חדש נחת בארנק',
    defaults: { email: true, push: true, in_app: true },
  },
  balance_updated: {
    id: 'balance_updated',
    label: 'יש יתרה חדשה',
    defaults: { email: false, push: true, in_app: true },
  },
  coupon_finished: {
    id: 'coupon_finished',
    label: 'קופון נוצל עד הסוף',
    defaults: { email: false, push: true, in_app: true },
  },
  savings_milestone: {
    id: 'savings_milestone',
    label: 'החיסכון עולה שלב',
    defaults: { email: true, push: false, in_app: true },
  },
  coupon_milestone: {
    id: 'coupon_milestone',
    label: 'הארנק עולה שלב',
    defaults: { email: false, push: false, in_app: true },
  },
  expired_unused: {
    id: 'expired_unused',
    label: 'יתרה שלא הספקנו לנצל',
    defaults: { email: true, push: false, in_app: true },
  },
  nearby_store: {
    id: 'nearby_store',
    label: 'קופון מחכה ממש לידך',
    // The device raises this one itself, from a geofence, with no server
    // involved — so push is the only channel that can carry it.
    defaults: { email: false, push: true, in_app: false },
  },
};

/**
 * "869.80 ש״ח".
 *
 * Spelled out rather than the ₪ sign: a notification is a sentence someone
 * reads in a shade or an inbox, and the letters read as speech where the sign
 * reads as a form field. It also sidesteps every mail client and launcher that
 * lays the sign out on the wrong side of the digits.
 */
export function money(amount: number): string {
  return `${amount.toFixed(2)} ש״ח`;
}

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function monthName(month: number): string {
  return MONTHS[month] || '';
}

/** "3 חודשים" / "חודש" / "חודשיים" — Hebrew counts the first two by name. */
export function monthsPhrase(count: number): string {
  if (count <= 1) return 'חודש';
  if (count === 2) return 'חודשיים';
  return `${count} חודשים`;
}

export type NotificationCopy = { title: string; body: string; link: string };

/**
 * The message for one event.
 *
 * Every body names the number, because the number is the reason to care, and
 * ends on something the reader can do or feel — never on a bare statistic.
 */
export function copyFor(type: NotificationTypeId, payload: Record<string, any>): NotificationCopy {
  switch (type) {
    case 'expiry': {
      const names: string[] = payload.names || [];
      return {
        title: names.length === 1 ? 'רגע לפני שהקופון פג' : 'כמה קופונים מחכים למימוש',
        body: `שווה לבדוק לפני שהם פגים ${payload.when}: ${names.join(', ')}`,
        link: '/coupons',
      };
    }
    case 'monthly_summary': {
      const label = `${monthName(payload.month)} ${payload.year}`;
      const best = payload.isBest
        ? ' זה החודש הכי טוב שלך עד עכשיו 🎉'
        : '';
      return {
        title: 'החודש שלך במספרים',
        body: `ב${label} נחסכו ${money(payload.amount)}.${best}`,
        link: '/statistics',
      };
    }
    case 'idle_money': {
      // The alert is about specific coupons, so it opens the list on exactly
      // those. Older rows carry no ids and still land on the full wallet.
      const ids = Array.isArray(payload.couponIds) ? payload.couponIds : [];
      return {
        title: 'יש יתרה שמחכה בארנק',
        body: `${money(payload.amount)} מחכים כבר ${monthsPhrase(payload.months)} למימוש. שווה להציץ.`,
        link: ids.length ? `/coupons?ids=${ids.join(',')}` : '/coupons',
      };
    }
    case 'share_received':
      return {
        title: 'קופון חדש נחת בארנק',
        body: `${payload.fromName} שלחו לך קופון של ${payload.company}. הוא כבר מחכה בארנק.`,
        link: '/sharing',
      };
    case 'balance_updated': {
      const extra = Number(payload.extra || 0);
      const alsoOthers = extra > 0
        ? ` ועוד ${extra === 1 ? 'קופון אחד' : `${extra} קופונים`} התעדכנו.`
        : '';
      return {
        title: 'יש יתרה חדשה',
        body: `עדכון קטן: נשארו ${money(payload.balance)} ב${payload.company}.${alsoOthers}`,
        link: extra > 0 || (!payload.couponPublicId && !payload.couponId)
          ? '/coupons'
          : `/coupons/${payload.couponPublicId || payload.couponId}`,
      };
    }
    case 'coupon_finished':
      return {
        title: 'הקופון נוצל עד הסוף 💪',
        body: `${payload.company} נסגר עם חיסכון של ${money(payload.saved)}.`,
        link: '/statistics',
      };
    case 'savings_milestone':
      return {
        title: 'החיסכון עלה שלב',
        body: `${money(payload.threshold)} כבר נחסכו. הכול התחיל מקופון אחד 🎉`,
        link: '/statistics',
      };
    case 'coupon_milestone':
      return {
        title: payload.count === 1 ? 'הקופון הראשון בארנק' : 'הארנק מתמלא',
        body: payload.count === 1
          ? 'הכנסת את הקופון הראשון שלך. מכאן אנחנו שומרים עליו — נזכיר לך לפני שהוא פג.'
          : `${payload.count} קופונים בארנק. יפה 👏`,
        link: '/coupons',
      };
    case 'nearby_store':
      return {
        title: `${payload.company} ממש קרוב`,
        body: `יש כאן קופון עם ${money(payload.remaining)} שעוד אפשר לנצל.`,
        link: payload.couponPublicId || payload.couponId
          ? `/coupons/${payload.couponPublicId || payload.couponId}`
          : '/coupons',
      };
    case 'expired_unused':
      return {
        title: 'יתרה שלא הספקנו לנצל',
        body: `הקופון ב${payload.company} פג עם ${money(payload.remaining)}. בפעם הבאה נוכל להזכיר מוקדם יותר.`,
        link: '/notification-settings',
      };
    default:
      return { title: 'קופון מאסטר', body: 'יש עדכון חדש בארנק שלך.', link: '/notifications' };
  }
}
