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
  | "expired_unused";

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
    label: "קופון עומד לפוג",
    description: "תזכורת לפני שקופון מאבד את הערך שלו",
    sample: "הקופון שלך ב־VANS פג בעוד 11 ימים",
    defaults: { email: true, push: true, in_app: true },
  },
  {
    id: "share_received",
    label: "שיתפו איתך קופון",
    description: "כשמישהו שולח לך קופון",
    sample: "נועה שיתפה איתך קופון של Wolt",
    defaults: { email: true, push: true, in_app: true },
  },
  {
    id: "idle_money",
    label: "כסף ששוכב בארנק",
    description: "פעם בחודש, על יתרות שלא נגעת בהן",
    sample: "240.00 ₪ יושבים בארנק כבר 3 חודשים",
    defaults: { email: true, push: true, in_app: true },
  },
  {
    id: "balance_updated",
    label: "יתרה התעדכנה",
    description: "כשאנחנו בודקים יתרה בשבילך והיא השתנתה",
    sample: "היתרה ב־Multipass עומדת עכשיו על 120.00 ₪",
    defaults: { email: false, push: true, in_app: true },
  },
  {
    id: "coupon_finished",
    label: "סיימת קופון",
    description: "רגע קטן של סיפוק כשקופון נגמר",
    sample: "סיימת את הקופון של גוד פארם. חסכת עליו 60.00 ₪",
    defaults: { email: false, push: true, in_app: true },
  },
  {
    id: "monthly_summary",
    label: "סיכום חודשי",
    description: "בתחילת כל חודש, כמה חסכת בחודש שעבר",
    sample: "באוגוסט חסכת 869.80 ₪",
    defaults: { email: true, push: false, in_app: true },
  },
  {
    id: "savings_milestone",
    label: "אבני דרך בחיסכון",
    description: "כשעוברים סכום עגול של חיסכון מצטבר",
    sample: "עברת 20,000 ₪ חיסכון מצטבר 🎉",
    defaults: { email: true, push: false, in_app: true },
  },
  {
    id: "coupon_milestone",
    label: "אבני דרך בארנק",
    description: "הקופון הראשון, העשירי, וכן הלאה",
    sample: "10 קופונים בארנק. יפה 👏",
    defaults: { email: false, push: false, in_app: true },
  },
  {
    id: "expired_unused",
    label: "קופון פג בלי שנוצל",
    description: "פעם אחת בלבד, כדי שנוכל לתזכר מוקדם יותר בפעם הבאה",
    sample: "הקופון בקסטרו פג עם 80.00 ₪ שלא נוצלו",
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
