// Email chrome in the app's visual language.
//
// Tokens copied from src/lib/theme.ts ("Coupon Master - Redesign"): the warm
// neutral shell, the blue brand, the status colours. Mail clients cannot import
// from there, so the values are duplicated — keep them in step by hand.
//
// Constraints this file exists to satisfy: table layout (flexbox and grid are
// unreliable in Outlook), every style inline (no <style> block survives Gmail),
// Heebo requested by link with a system fallback stack, and a fixed 600px body.

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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${COLOR.card};border:1px solid ${COLOR.cardBorder};border-radius:16px">
        <tr>
          <td width="4" style="background:${accent.bar};border-radius:0 16px 16px 0;font-size:0">&nbsp;</td>
          <td style="padding:14px 16px">
            <div style="font-family:${FONT};font-size:16px;font-weight:700;color:${COLOR.text};line-height:1.4">
              ${escapeHtml(coupon.company)}
            </div>
            <div style="font-family:${FONT};font-size:13px;color:${COLOR.textMuted};padding-top:2px">
              בתוקף עד ${formatDate(coupon.expiration)}
            </div>
          </td>
          <td align="left" style="padding:14px 16px;white-space:nowrap">
            <div style="font-family:${FONT};font-size:18px;font-weight:800;color:${COLOR.primary}">
              ₪${coupon.remaining.toFixed(2)}
            </div>
            <div style="font-family:${FONT};font-size:11px;color:${COLOR.textMuted}">יתרה</div>
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
         <td align="center" style="padding:6px 0 4px 0">
           <a href="${escapeHtml(appUrl)}"
              style="display:inline-block;background:${COLOR.primary};color:#ffffff;font-family:${FONT};
                     font-size:15px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:12px">
             פתיחת הקופונים שלי
           </a>
         </td>
       </tr>`
    : '';

  const footer = unsubscribeUrl
    ? `<p style="margin:10px 0 0 0;font-family:${FONT};font-size:12px;color:${COLOR.textMuted};line-height:1.6">
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
<body style="margin:0;padding:0;background:${COLOR.shell}">
  <!-- Preheader: the grey line clients show next to the subject. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    ${escapeHtml(headline)} ${escapeHtml(whenLabel(days))} — יתרה כוללת ₪${total.toFixed(2)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${COLOR.shell};padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px">

          <!-- The app chrome is dark in both themes; the header follows it. -->
          <tr>
            <td style="background:${COLOR.headerBg};border-radius:20px 20px 0 0;padding:22px 24px">
              <div style="font-family:${FONT};font-size:19px;font-weight:800;color:#ffffff">
                קופון מאסטר
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.card};padding:26px 24px 22px 24px">
              <div style="font-family:${FONT};font-size:15px;color:${COLOR.textSecondary}">
                שלום ${escapeHtml(firstName || '')},
              </div>

              <div style="font-family:${FONT};font-size:24px;font-weight:800;color:${COLOR.text};
                          line-height:1.35;padding:6px 0 12px 0">
                ${escapeHtml(headline)} ${escapeHtml(whenLabel(days))}
              </div>

              <span style="display:inline-block;background:${accent.bg};color:${accent.text};
                           font-family:${FONT};font-size:13px;font-weight:700;
                           padding:6px 14px;border-radius:999px">
                יתרה כוללת ₪${total.toFixed(2)}
              </span>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="padding-top:18px">
                ${coupons.map((coupon) => couponRow(coupon, accent)).join('')}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${cta}
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${COLOR.surface};border-radius:0 0 20px 20px;
                       border-top:1px solid ${COLOR.divider};padding:18px 24px">
              <p style="margin:0;font-family:${FONT};font-size:13px;color:${COLOR.textMuted};line-height:1.6">
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
