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
  | 'expired_unused';

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
    label: 'קופון עומד לפוג',
    defaults: { email: true, push: true, in_app: true },
  },
  monthly_summary: {
    id: 'monthly_summary',
    label: 'סיכום חודשי',
    defaults: { email: true, push: false, in_app: true },
  },
  idle_money: {
    id: 'idle_money',
    label: 'כסף ששוכב בארנק',
    defaults: { email: true, push: true, in_app: true },
  },
  share_received: {
    id: 'share_received',
    label: 'שיתפו איתך קופון',
    defaults: { email: true, push: true, in_app: true },
  },
  balance_updated: {
    id: 'balance_updated',
    label: 'יתרה התעדכנה',
    defaults: { email: false, push: true, in_app: true },
  },
  coupon_finished: {
    id: 'coupon_finished',
    label: 'סיימת קופון',
    defaults: { email: false, push: true, in_app: true },
  },
  savings_milestone: {
    id: 'savings_milestone',
    label: 'אבני דרך בחיסכון',
    defaults: { email: true, push: false, in_app: true },
  },
  coupon_milestone: {
    id: 'coupon_milestone',
    label: 'אבני דרך בארנק',
    defaults: { email: false, push: false, in_app: true },
  },
  expired_unused: {
    id: 'expired_unused',
    label: 'קופון פג בלי שנוצל',
    defaults: { email: true, push: false, in_app: true },
  },
};

/** "869.80 ₪", glued so bidi keeps the sign beside the digits. */
export function money(amount: number): string {
  return `${amount.toFixed(2)} ₪`;
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
    case 'monthly_summary': {
      const label = `${monthName(payload.month)} ${payload.year}`;
      const best = payload.isBest
        ? ' זה החודש הכי טוב שלך עד עכשיו 🎉'
        : '';
      return {
        title: 'הסיכום החודשי שלך',
        body: `ב${label} חסכת ${money(payload.amount)}.${best}`,
        link: '/statistics',
      };
    }
    case 'idle_money':
      return {
        title: 'יש לך כסף שמחכה',
        body: `${money(payload.amount)} יושבים בארנק כבר ${monthsPhrase(payload.months)} בלי שנגעת בהם. שווה מבט.`,
        link: '/coupons',
      };
    case 'share_received':
      return {
        title: 'שיתפו איתך קופון',
        body: `${payload.fromName} שיתף איתך קופון של ${payload.company}. הוא כבר מחכה לך בארנק.`,
        link: '/sharing',
      };
    case 'balance_updated': {
      const extra = Number(payload.extra || 0);
      const alsoOthers = extra > 0
        ? ` ועוד ${extra === 1 ? 'קופון אחד' : `${extra} קופונים`} התעדכנו.`
        : '';
      return {
        title: 'עדכנו לך את היתרה',
        body: `בדקנו בשבילך: היתרה ב${payload.company} עומדת עכשיו על ${money(payload.balance)}.${alsoOthers}`,
        link: extra > 0 || !payload.couponId ? '/coupons' : `/coupons/${payload.couponId}`,
      };
    }
    case 'coupon_finished':
      return {
        title: 'סגרת קופון 💪',
        body: `סיימת את הקופון של ${payload.company}. חסכת עליו ${money(payload.saved)}.`,
        link: '/statistics',
      };
    case 'savings_milestone':
      return {
        title: 'אבן דרך',
        body: `עברת ${money(payload.threshold)} חיסכון מצטבר. הכל התחיל מקופון אחד 🎉`,
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
    case 'expired_unused':
      return {
        title: 'קופון פג בלי שנוצל',
        body: `הקופון ב${payload.company} פג עם ${money(payload.remaining)} שלא נוצלו. שנזכיר לך מוקדם יותר בפעם הבאה?`,
        link: '/notification-settings',
      };
    default:
      return { title: 'קופון מאסטר', body: 'יש עדכון חדש בארנק שלך.', link: '/notifications' };
  }
}
