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
  | "savings_milestone"
  | "coupon_milestone"
  | "expired_unused"
  | "nearby_store";

export type NotificationTypeMeta = {
  id: NotificationTypeId;
  label: string;
  description: string;
  /** One line of the real thing, so the choice is concrete. */
  sample: string;
  defaults: Record<NotificationChannel, boolean>;
};

export const NOTIFICATION_TYPES: NotificationTypeMeta[] = [
  {
    id: "expiry",
    label: "רגע לפני שקופון פג",
    description: "תזכורת בזמן, כדי שהיתרה לא תלך לאיבוד",
    sample: "VANS מחכה למימוש — נשארו 11 ימים",
    defaults: { email: true, push: true, in_app: true },
  },
  {
    id: "share_received",
    label: "קופון חדש נחת בארנק",
    description: "כשמגיע אליך קופון ממישהו אחר",
    sample: "נועה שלחה לך קופון של Wolt",
    defaults: { email: true, push: true, in_app: true },
  },
  {
    id: "idle_money",
    label: "יתרה שמחכה למימוש",
    description: "פעם בחודש, תזכורת על כסף שעוד מחכה בארנק",
    sample: "240.00 ש״ח עדיין מחכים בארנק",
    defaults: { email: true, push: true, in_app: true },
  },
  {
    id: "balance_updated",
    label: "יש יתרה חדשה",
    description: "כשהיתרה משתנה אחרי בדיקה שלנו",
    sample: "עדכון קטן: נשארו 120.00 ש״ח ב־Multipass",
    defaults: { email: false, push: true, in_app: true },
  },
  {
    id: "coupon_finished",
    label: "קופון נוצל עד הסוף",
    description: "רגע קטן של סיפוק כשהיתרה מגיעה לאפס",
    sample: "הקופון של גוד פארם נוצל עד הסוף — 60.00 ש״ח נחסכו",
    defaults: { email: false, push: true, in_app: true },
  },
  {
    id: "monthly_summary",
    label: "החודש שלך במספרים",
    description: "בתחילת כל חודש, סיכום קצר של החיסכון",
    sample: "אוגוסט נסגר עם חיסכון של 869.80 ש״ח",
    defaults: { email: true, push: false, in_app: true },
  },
  {
    id: "savings_milestone",
    label: "החיסכון עולה שלב",
    description: "כשסך החיסכון מגיע למספר ששווה לחגוג",
    sample: "20,000 ש״ח כבר נחסכו 🎉",
    defaults: { email: true, push: false, in_app: true },
  },
  {
    id: "coupon_milestone",
    label: "הארנק עולה שלב",
    description: "בקופון הראשון, העשירי ובהמשך הדרך",
    sample: "10 קופונים בארנק. יפה 👏",
    defaults: { email: false, push: false, in_app: true },
  },
  {
    id: "nearby_store",
    label: "קופון מחכה ממש לידך",
    description: "תזכורת כשיש יתרה במקום קרוב. המיקום נשאר במכשיר",
    sample: "רולדין ממש קרוב — ויש שם 45.00 ש״ח לנצל",
    defaults: { email: false, push: true, in_app: false },
  },
  {
    id: "expired_unused",
    label: "יתרה שלא הספקנו לנצל",
    description: "עדכון חד־פעמי שיעזור לתזכר מוקדם יותר בפעם הבאה",
    sample: "הקופון בקסטרו פג עם יתרה של 80.00 ש״ח",
    defaults: { email: true, push: false, in_app: true },
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
