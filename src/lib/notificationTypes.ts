/**
 * What the app can tell you, as the settings screen presents it.
 *
 * The ids and the defaults mirror supabase/functions/_shared/notificationTypes.ts,
 * which is where the sending side reads them. An edge function cannot import
 * from src/, so the two files are kept in step by hand — if an id or a default
 * changes there, change it here in the same commit, or the switch a user sees
 * will describe something other than what they get.
 *
 * The descriptions are written as the thing the user will actually receive, not
 * as a category name: "נגיד לך כמה חסכת בחודש שעבר" tells someone what turning
 * this on means; "סיכום חודשי" does not.
 */

export type NotificationChannel = "email" | "push" | "in_app";

export type NotificationTypeId =
  | "expiry"
  | "monthly_summary"
  | "idle_money"
  | "share_received"
  | "balance_updated"
  | "coupon_finished"
  | "coupon_milestone"
  | "expired_unused";

export type NotificationTypeMeta = {
  id: NotificationTypeId;
  label: string;
  description: string;
  /** One line of the real thing, so the choice is concrete. */
  sample: string;
  defaults: Record<NotificationChannel, boolean>;
  /** The full explanation shown from the question mark. */
  explanation: {
    what: string;
    when: string;
    where: string;
  };
};

export const NOTIFICATION_TYPES: NotificationTypeMeta[] = [
  {
    id: "expiry",
    label: "רגע לפני שקופון פג",
    description: "תזכורת בזמן, כדי שהיתרה לא תלך לאיבוד",
    sample: "VANS מחכה למימוש — נשארו 11 ימים",
    defaults: { email: true, push: true, in_app: true },
    explanation: {
      what: "תזכורת עם שם הקופון וכמה ימים נשארו עד שהוא פג.",
      when: "כל שעה, לפי החלונות 30 / 7 / 1 / 0 ימים, או כל יום בקירוב לפקיעה.",
      where: "מסך הקופונים.",
    },
  },
  {
    id: "share_received",
    label: "קופון חדש נחת בארנק",
    description: "כשמגיע אליך קופון ממישהו אחר",
    sample: "נועה שלחה לך קופון של Wolt",
    defaults: { email: true, push: true, in_app: true },
    explanation: {
      what: "מישהו הזמין אותך לקבל קופון. הקופון נפתח רק אחרי שתאשר.",
      when: "מיד כשמישהו שולח אליך הזמנה.",
      where: "מסך השיתוף.",
    },
  },
  {
    id: "idle_money",
    label: "יתרה שמחכה למימוש",
    description: "פעם בחודש, תזכורת על כסף שעוד מחכה בארנק",
    sample: "240.00 ש״ח עדיין מחכים בארנק",
    defaults: { email: true, push: true, in_app: true },
    explanation: {
      what: "תזכורת על יתרה שלא נגעת בה הרבה זמן.",
      when: "פעם בחודש, אם יש יתרה מעל 50 ש״ח שלא נצפתה 90 יום.",
      where: "הקופונים הרלוונטיים.",
    },
  },
  {
    id: "balance_updated",
    label: "יש יתרה חדשה",
    description: "כשהיתרה משתנה אחרי בדיקה שלנו",
    sample: "עדכון קטן: נשארו 120.00 ש״ח ב־Multipass",
    defaults: { email: false, push: true, in_app: true },
    explanation: {
      what: "האפליקציה בדקה יתרה אוטומטית והסכום השתנה.",
      when: "אחרי בדיקה אוטומטית של יתרת קופון.",
      where: "הקופון המעודכן, או רשימת הקופונים.",
    },
  },
  {
    id: "coupon_finished",
    label: "קופון נוצל עד הסוף",
    description: "רגע קטן של סיפוק כשהיתרה מגיעה לאפס",
    sample: "הקופון של גוד פארם נוצל עד הסוף — 60.00 ש״ח נחסכו",
    defaults: { email: false, push: true, in_app: true },
    explanation: {
      what: "קופון רגיל: סיכום כמה חסכת. קופון חד־פעמי: אישור שהוא סומן כנוצל, בלי סכום.",
      when: "כשהיתרה מגיעה לאפס, או כשחד־פעמי מסומן כנוצל.",
      where: "רגיל — סטטיסטיקות. חד־פעמי — הארנק.",
    },
  },
  {
    id: "monthly_summary",
    label: "החודש שלך במספרים",
    description: "בתחילת כל חודש, סיכום קצר של החיסכון",
    sample: "אוגוסט נסגר עם חיסכון של 869.80 ש״ח",
    defaults: { email: true, push: false, in_app: true },
    explanation: {
      what: "סיכום הסכום שנחסך בחודש שעבר.",
      when: "בשלושת הימים הראשונים של החודש, אם נחסך יותר מ־0.",
      where: "מסך הסטטיסטיקות.",
    },
  },
  {
    id: "coupon_milestone",
    label: "הארנק עולה שלב",
    description: "בקופון הראשון, העשירי ובהמשך הדרך",
    sample: "10 קופונים בארנק. יפה 👏",
    defaults: { email: false, push: false, in_app: true },
    explanation: {
      what: "עידוד כשהארנק מגיע למספר עגול של קופונים.",
      when: "בקופון הראשון, העשירי, החמישים והמאה.",
      where: "מסך הקופונים.",
    },
  },
  {
    id: "expired_unused",
    label: "יתרה שלא הספקנו לנצל",
    description: "עדכון חד־פעמי שיעזור לתזכר מוקדם יותר בפעם הבאה",
    sample: "הקופון בקסטרו פג עם יתרה של 80.00 ש״ח",
    defaults: { email: true, push: false, in_app: true },
    explanation: {
      what: "קופון פג עם יתרה שנשארה, כדי להזכיר מוקדם יותר בפעם הבאה.",
      when: "כשקופון פג בשלושת הימים האחרונים עם יתרה גדולה מ־0.",
      where: "הגדרות התזכורות.",
    },
  },
];

export type TypeChannels = Partial<Record<NotificationTypeId, Partial<Record<NotificationChannel, boolean>>>>;

/** Whether a kind is on for a channel: the user's choice, else the default. */
export function isTypeChannelOn(
  typeChannels: TypeChannels | null | undefined,
  type: NotificationTypeId,
  channel: NotificationChannel,
): boolean {
  const override = typeChannels?.[type]?.[channel];
  if (override !== undefined) return override;
  return NOTIFICATION_TYPES.find((item) => item.id === type)?.defaults[channel] ?? false;
}

/** The stored object with one kind's one channel changed. */
export function withTypeChannel(
  typeChannels: TypeChannels | null | undefined,
  type: NotificationTypeId,
  channel: NotificationChannel,
  value: boolean,
): TypeChannels {
  return {
    ...(typeChannels || {}),
    [type]: { ...(typeChannels?.[type] || {}), [channel]: value },
  };
}
