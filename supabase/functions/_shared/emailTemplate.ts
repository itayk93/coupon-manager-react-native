// Email chrome in the app's visual language.
//
// Tokens copied from src/lib/theme.ts ("Coupon Master - Redesign"): the warm
// neutral shell, the blue brand, the status colours. Mail clients cannot import
// from there, so the values are duplicated — keep them in step by hand.
//
// Constraints this file exists to satisfy: table layout (flexbox and grid are
// unreliable in Outlook), every style inline (no <style> block survives Gmail),
// Heebo requested by link with a system fallback stack, and a fixed 600px body.
//
// Direction is repeated on every element that holds text. Gmail on iOS drops the
// dir attribute from <html> and <body> when it sanitises the message, which
// leaves the paragraph direction LTR: a line opening with a digit ("3 קופונים")
// has that digit thrown to the far end, and the shekel sign lands on the wrong
// side of the amount. Only direction declared further in survives.

const COLOR = {
  shell: '#eeece5',
  card: '#ffffff',
  cardBorder: '#e6e9ef',
  surface: '#f2f3fd',
  headerBg: '#15202e',
  primary: '#1f6fd1',
  primaryTint: '#e8f2fd',
  text: '#101828',
  textSecondary: '#475467',
  textMuted: '#667085',
  divider: '#f0f1f4',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#b45309',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerText: '#b91c1c',
} as const;

const FONT = "'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

/** Inline direction, repeated everywhere because Gmail strips it from <body>. */
const RTL = 'direction:rtl;text-align:right';

/** Right-to-left mark. Forces a line that opens with a digit to stay right-aligned. */
const RLM = '&#8207;';

/**
 * Hebrew writes the amount before the sign — "120.50 ₪" — which bidi then lays
 * out with the sign to the left of the digits. Authoring it the other way round
 * is what put the shekel on the wrong side.
 */
function money(amount: number) {
  return `${amount.toFixed(2)}&nbsp;₪`;
}

export type ExpiryCoupon = {
  company: string;
  remaining: number;
  expiration: string;
};

/** Urgency drives the accent, exactly like the coupon card badge in the app. */
function accentFor(days: number) {
  if (days === 0) return { bg: COLOR.dangerBg, text: COLOR.dangerText, bar: COLOR.danger };
  if (days <= 7) return { bg: COLOR.warningBg, text: COLOR.warningText, bar: COLOR.warning };
  return { bg: COLOR.primaryTint, text: COLOR.primary, bar: COLOR.primary };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] || char);
}

function whenLabel(days: number) {
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  if (days === 7) return 'בעוד שבוע';
  return `בעוד ${days} ימים`;
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function couponRow(coupon: ExpiryCoupon, accent: ReturnType<typeof accentFor>) {
  return `
  <tr>
    <td style="padding:0 0 10px 0">
      <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="${RTL};background:${COLOR.card};border:1px solid ${COLOR.cardBorder};border-radius:16px">
        <tr>
          <td width="4" style="background:${accent.bar};border-radius:0 16px 16px 0;font-size:0">&nbsp;</td>
          <td dir="rtl" align="right" style="${RTL};padding:14px 16px">
            <div dir="rtl" style="${RTL};font-family:${FONT};font-size:16px;font-weight:700;color:${COLOR.text};line-height:1.4">
              ${escapeHtml(coupon.company)}
            </div>
            <div dir="rtl" style="${RTL};font-family:${FONT};font-size:13px;color:${COLOR.textMuted};padding-top:2px">
              ${RLM}בתוקף עד ${formatDate(coupon.expiration)}
            </div>
          </td>
          <td dir="rtl" align="left" style="direction:rtl;text-align:left;padding:14px 16px;white-space:nowrap">
            <div dir="rtl" style="direction:rtl;text-align:left;font-family:${FONT};font-size:18px;font-weight:800;color:${COLOR.primary}">
              ${RLM}${money(coupon.remaining)}
            </div>
            <div dir="rtl" style="direction:rtl;text-align:left;font-family:${FONT};font-size:11px;color:${COLOR.textMuted}">יתרה</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function expiryEmailHtml(options: {
  firstName: string;
  days: number;
  coupons: ExpiryCoupon[];
  appUrl: string | null;
  unsubscribeUrl: string | null;
}): string {
  const { firstName, days, coupons, appUrl, unsubscribeUrl } = options;
  const accent = accentFor(days);
  const total = coupons.reduce((sum, c) => sum + c.remaining, 0);
  const headline = coupons.length === 1
    ? 'קופון אחד עומד לפוג'
    : `${coupons.length} קופונים עומדים לפוג`;

  const cta = appUrl
    ? `<tr>
         <td dir="rtl" align="center" style="${RTL};text-align:center;padding:6px 0 4px 0">
           <a href="${escapeHtml(appUrl)}"
              style="display:inline-block;background:${COLOR.primary};color:#ffffff;font-family:${FONT};
                     font-size:15px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:12px">
             פתיחת הקופונים שלי
           </a>
         </td>
       </tr>`
    : '';

  const footer = unsubscribeUrl
    ? `<p dir="rtl" style="${RTL};margin:10px 0 0 0;font-family:${FONT};font-size:12px;color:${COLOR.textMuted};line-height:1.6">
         לא רוצה לקבל תזכורות תפוגה במייל?
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLOR.textSecondary}">אפשר לבטל כאן</a>.
       </p>`
    : '';

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(headline)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap" rel="stylesheet">
</head>
<body dir="rtl" style="${RTL};margin:0;padding:0;background:${COLOR.shell}">
  <!-- Preheader: the grey line clients show next to the subject. -->
  <div dir="rtl" style="${RTL};display:none;max-height:0;overflow:hidden;opacity:0">
    ${RLM}${escapeHtml(headline)} ${escapeHtml(whenLabel(days))} — יתרה כוללת ${money(total)}
  </div>

  <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="${RTL};background:${COLOR.shell};padding:24px 12px">
    <tr>
      <td dir="rtl" align="center" style="${RTL};text-align:center">
        <table dir="rtl" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="${RTL};width:100%;max-width:600px">

          <!-- The app chrome is dark in both themes; the header follows it. -->
          <tr>
            <td dir="rtl" align="right" style="${RTL};background:${COLOR.headerBg};border-radius:20px 20px 0 0;padding:22px 24px">
              <div dir="rtl" style="${RTL};font-family:${FONT};font-size:19px;font-weight:800;color:#ffffff">
                קופון מאסטר
              </div>
            </td>
          </tr>

          <tr>
            <td dir="rtl" align="right" style="${RTL};background:${COLOR.card};padding:26px 24px 22px 24px">
              <div dir="rtl" style="${RTL};font-family:${FONT};font-size:15px;color:${COLOR.textSecondary}">
                שלום ${escapeHtml(firstName || '')},
              </div>

              <div dir="rtl" style="${RTL};font-family:${FONT};font-size:24px;font-weight:800;color:${COLOR.text};
                          line-height:1.35;padding:6px 0 12px 0">
                ${RLM}${escapeHtml(headline)} ${escapeHtml(whenLabel(days))}
              </div>

              <span dir="rtl" style="${RTL};display:inline-block;background:${accent.bg};color:${accent.text};
                           font-family:${FONT};font-size:13px;font-weight:700;
                           padding:6px 14px;border-radius:999px">
                ${RLM}יתרה כוללת ${money(total)}
              </span>

              <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="${RTL};padding-top:18px">
                ${coupons.map((coupon) => couponRow(coupon, accent)).join('')}
              </table>

              <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${RTL}">
                ${cta}
              </table>
            </td>
          </tr>

          <tr>
            <td dir="rtl" align="right" style="${RTL};background:${COLOR.surface};border-radius:0 0 20px 20px;
                       border-top:1px solid ${COLOR.divider};padding:18px 24px">
              <p dir="rtl" style="${RTL};margin:0;font-family:${FONT};font-size:13px;color:${COLOR.textMuted};line-height:1.6">
                אפשר לכבות או לכוונן את התזכורות במסך ההגדרות באפליקציה.
              </p>
              ${footer}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
