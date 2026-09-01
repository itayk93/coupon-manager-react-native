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

/**
 * Signed ILS inside an RTL email.
 *
 * Gmail reorders the logical `+44.80 ₪` into `₪ 44.80+`. Keeping the plus
 * after the digits in the source makes both symbols render to their left:
 * `₪ +44.80`.
 */
function positiveMoney(amount: number) {
  return `${amount.toFixed(2)}+&nbsp;₪`;
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
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLOR.textSecondary}">ניהול ההתראות וביטול</a>.
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

export type MultipassSummaryItem = {
  coupon_id?: number;
  company?: string;
  old_usage?: number;
  new_usage?: number;
  delta?: number;
  value?: number;
  remaining_value?: number;
  place_name?: string | null;
  place_address?: string | null;
};

function multipassCouponCard(item: MultipassSummaryItem) {
  const remaining = Number(item.remaining_value || 0);
  const depleted = remaining <= 0;
  return `
  <tr>
    <td style="padding:0 0 14px 0">
      <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="${RTL};background:${COLOR.card};border:1px solid ${COLOR.cardBorder};border-radius:16px">
        <tr>
          <td dir="rtl" align="right" style="${RTL};background:${depleted ? COLOR.textMuted : COLOR.primary};border-radius:16px 16px 0 0;padding:15px 18px">
            <div dir="rtl" style="${RTL};font-family:${FONT};font-size:12px;font-weight:700;color:#ffffff;opacity:.88">קופון שעודכן</div>
            <div dir="rtl" style="${RTL};font-family:${FONT};font-size:19px;font-weight:800;color:#ffffff;padding-top:3px">
              ${escapeHtml(String(item.company || 'קופון'))}${item.coupon_id ? ` <span style="font-size:12px;font-weight:500;opacity:.8">· #${item.coupon_id}</span>` : ''}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 18px 6px 18px">
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${RTL}">
              <tr>
                <td dir="rtl" align="center" width="33%" style="${RTL};text-align:center;background:${COLOR.surface};border-radius:12px;padding:12px 6px">
                  <div style="font-family:${FONT};font-size:11px;color:${COLOR.textMuted}">שימוש לפני</div>
                  <div style="font-family:${FONT};font-size:17px;font-weight:800;color:${COLOR.text};padding-top:3px;white-space:nowrap">${RLM}${money(Number(item.old_usage || 0))}</div>
                </td>
                <td width="8" style="font-size:0">&nbsp;</td>
                <td dir="rtl" align="center" width="33%" style="${RTL};text-align:center;background:${COLOR.primaryTint};border-radius:12px;padding:12px 6px">
                  <div style="font-family:${FONT};font-size:11px;color:${COLOR.primary}">נוסף בשימוש</div>
                  <div style="font-family:${FONT};font-size:17px;font-weight:800;color:${COLOR.primary};padding-top:3px;white-space:nowrap">${RLM}${positiveMoney(Number(item.delta || 0))}</div>
                </td>
                <td width="8" style="font-size:0">&nbsp;</td>
                <td dir="rtl" align="center" width="33%" style="${RTL};text-align:center;background:${depleted ? COLOR.dangerBg : '#dcfce7'};border-radius:12px;padding:12px 6px">
                  <div style="font-family:${FONT};font-size:11px;color:${depleted ? COLOR.dangerText : '#15803d'}">יתרה עכשיו</div>
                  <div style="font-family:${FONT};font-size:17px;font-weight:800;color:${depleted ? COLOR.dangerText : '#15803d'};padding-top:3px;white-space:nowrap">${RLM}${money(remaining)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td dir="rtl" align="right" style="${RTL};padding:7px 18px 16px 18px">
            <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${RTL}">
              <tr><td style="font-family:${FONT};font-size:13px;color:${COLOR.textMuted};padding:5px 0">שימוש מצטבר</td><td align="left" style="font-family:${FONT};font-size:14px;font-weight:700;color:${COLOR.text};text-align:left">${RLM}${money(Number(item.new_usage || 0))}</td></tr>
              <tr><td style="font-family:${FONT};font-size:13px;color:${COLOR.textMuted};padding:5px 0">שווי הקופון</td><td align="left" style="font-family:${FONT};font-size:14px;font-weight:700;color:${COLOR.text};text-align:left">${RLM}${money(Number(item.value || 0))}</td></tr>
              ${item.place_name ? `<tr><td style="font-family:${FONT};font-size:13px;color:${COLOR.textMuted};padding:5px 0">בית העסק</td><td align="left" style="font-family:${FONT};font-size:14px;font-weight:700;color:${COLOR.text};text-align:left">${escapeHtml(item.place_name)}</td></tr>` : ''}
              ${item.place_address ? `<tr><td style="font-family:${FONT};font-size:13px;color:${COLOR.textMuted};padding:5px 0">כתובת</td><td align="left" style="font-family:${FONT};font-size:13px;color:${COLOR.textSecondary};text-align:left">${escapeHtml(item.place_address)}</td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function multipassSummaryEmailHtml(options: {
  firstName: string;
  runDate: string;
  scanned: number;
  failed: number;
  skipped: number;
  items: MultipassSummaryItem[];
  failures: string[];
  appUrl: string;
}): string {
  const { firstName, runDate, scanned, failed, skipped, items, failures, appUrl } = options;
  const totalDelta = items.reduce((sum, item) => sum + Number(item.delta || 0), 0);
  const totalRemaining = items.reduce((sum, item) => sum + Number(item.remaining_value || 0), 0);
  const headline = items.length > 0
    ? `${items.length === 1 ? 'קופון אחד עודכן' : `${items.length} קופונים עודכנו`}`
    : 'הבדיקה הסתיימה ללא שינוי חדש';
  const failureBlock = failures.length > 0
    ? `<tr><td dir="rtl" style="${RTL};background:${COLOR.dangerBg};border:1px solid #fecaca;border-radius:14px;padding:14px 16px;font-family:${FONT};font-size:13px;color:${COLOR.dangerText}"><strong>מה לא הצליח</strong><br>${failures.map(escapeHtml).join('<br>')}</td></tr>`
    : '';

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(headline)}</title></head>
<body dir="rtl" style="${RTL};margin:0;padding:0;background:${COLOR.shell}">
  <div dir="rtl" style="display:none;max-height:0;overflow:hidden;opacity:0">${RLM}${escapeHtml(headline)} · שינוי כולל ${money(totalDelta)} · יתרה ${money(totalRemaining)}</div>
  <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${RTL};background:${COLOR.shell};padding:24px 12px">
    <tr><td align="center">
      <table dir="rtl" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="${RTL};width:100%;max-width:600px">
        <tr><td dir="rtl" align="right" style="${RTL};background:${COLOR.headerBg};border-radius:20px 20px 0 0;padding:22px 24px">
          <div style="font-family:${FONT};font-size:19px;font-weight:800;color:#fff">קופון מאסטר</div>
          <div style="font-family:${FONT};font-size:12px;color:#cbd5e1;padding-top:3px">הארנק החכם שלך</div>
        </td></tr>
        <tr><td dir="rtl" align="right" style="${RTL};background:${COLOR.card};padding:26px 24px 22px">
          <div style="font-family:${FONT};font-size:15px;color:${COLOR.textSecondary}">שלום ${escapeHtml(firstName || '')},</div>
          <div style="font-family:${FONT};font-size:25px;font-weight:800;color:${COLOR.text};line-height:1.3;padding:7px 0 4px">${RLM}${escapeHtml(headline)}</div>
          <div style="font-family:${FONT};font-size:13px;color:${COLOR.textMuted};padding-bottom:18px">${escapeHtml(runDate)}</div>

          <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${RTL};margin-bottom:18px">
            <tr>
              <td align="center" style="background:${COLOR.primaryTint};border-radius:14px;padding:13px 6px"><div style="font-family:${FONT};font-size:11px;color:${COLOR.primary}">נסרקו</div><div style="font-family:${FONT};font-size:22px;font-weight:800;color:${COLOR.primary}">${scanned}</div></td>
              <td width="8">&nbsp;</td>
              <td align="center" style="background:#dcfce7;border-radius:14px;padding:13px 6px"><div style="font-family:${FONT};font-size:11px;color:#15803d">שינוי כולל</div><div style="font-family:${FONT};font-size:18px;font-weight:800;color:#15803d;white-space:nowrap">${RLM}${positiveMoney(totalDelta)}</div></td>
              <td width="8">&nbsp;</td>
              <td align="center" style="background:${COLOR.surface};border-radius:14px;padding:13px 6px"><div style="font-family:${FONT};font-size:11px;color:${COLOR.textMuted}">נכשלו</div><div style="font-family:${FONT};font-size:22px;font-weight:800;color:${failed ? COLOR.dangerText : COLOR.text}">${failed}</div></td>
            </tr>
          </table>

          <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${RTL}">
            ${items.map(multipassCouponCard).join('') || `<tr><td style="background:${COLOR.surface};border-radius:14px;padding:18px;font-family:${FONT};font-size:15px;color:${COLOR.textSecondary}">כל הקופונים שנבדקו כבר מעודכנים. לא נמצאו עסקאות חדשות.</td></tr>`}
            ${failureBlock}
            <tr><td align="center" style="padding:20px 0 4px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:${COLOR.primary};color:#fff;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:12px">לצפייה בקופונים שלי</a></td></tr>
          </table>
        </td></tr>
        <tr><td dir="rtl" align="right" style="${RTL};background:${COLOR.surface};border-radius:0 0 20px 20px;border-top:1px solid ${COLOR.divider};padding:17px 24px">
          <p style="margin:0;font-family:${FONT};font-size:12px;color:${COLOR.textMuted}">העדכון בוצע אוטומטית. נסרקו ${scanned} · דולגו ${skipped} · נכשלו ${failed}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * The chrome above, wrapped around one short message.
 *
 * The expiry mail is a list of coupons and needs the table; everything else the
 * app has to say is a headline, a sentence, and a button. Same header, same
 * footer, same unsubscribe — so a person who has seen one recognises the next.
 */
export function messageEmailHtml(options: {
  firstName: string;
  title: string;
  body: string;
  /** Optional big number, shown as a pill above the text. */
  highlight?: string | null;
  ctaLabel?: string | null;
  appUrl: string | null;
  unsubscribeUrl: string | null;
}): string {
  const { firstName, title, body, highlight, ctaLabel, appUrl, unsubscribeUrl } = options;

  const pill = highlight
    ? `<span dir="rtl" style="${RTL};display:inline-block;background:${COLOR.primaryTint};color:${COLOR.primary};
                 font-family:${FONT};font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px">
         ${RLM}${escapeHtml(highlight)}
       </span>`
    : '';

  const cta = appUrl
    ? `<tr>
         <td dir="rtl" align="center" style="${RTL};text-align:center;padding:20px 0 4px 0">
           <a href="${escapeHtml(appUrl)}"
              style="display:inline-block;background:${COLOR.primary};color:#ffffff;font-family:${FONT};
                     font-size:15px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:12px">
             ${escapeHtml(ctaLabel || 'לפתיחת האפליקציה')}
           </a>
         </td>
       </tr>`
    : '';

  const footer = unsubscribeUrl
    ? `<p dir="rtl" style="${RTL};margin:10px 0 0 0;font-family:${FONT};font-size:12px;color:${COLOR.textMuted};line-height:1.6">
         לא רוצה לקבל את ההודעות האלה?
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLOR.textSecondary}">ניהול ההתראות וביטול</a>.
       </p>`
    : '';

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap" rel="stylesheet">
</head>
<body dir="rtl" style="${RTL};margin:0;padding:0;background:${COLOR.shell}">
  <div dir="rtl" style="${RTL};display:none;max-height:0;overflow:hidden;opacity:0">
    ${RLM}${escapeHtml(body)}
  </div>

  <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="${RTL};background:${COLOR.shell};padding:24px 12px">
    <tr>
      <td dir="rtl" align="center" style="${RTL};text-align:center">
        <table dir="rtl" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="${RTL};width:100%;max-width:600px">

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
                ${RLM}${escapeHtml(title)}
              </div>

              ${pill}

              <p dir="rtl" style="${RTL};margin:14px 0 0 0;font-family:${FONT};font-size:16px;
                        color:${COLOR.textSecondary};line-height:1.7">
                ${RLM}${escapeHtml(body)}
              </p>

              <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${RTL}">
                ${cta}
              </table>
            </td>
          </tr>

          <tr>
            <td dir="rtl" align="right" style="${RTL};background:${COLOR.surface};border-radius:0 0 20px 20px;
                       border-top:1px solid ${COLOR.divider};padding:18px 24px">
              <p dir="rtl" style="${RTL};margin:0;font-family:${FONT};font-size:13px;color:${COLOR.textMuted};line-height:1.6">
                אפשר לבחור בדיוק אילו הודעות לקבל, ובאיזה ערוץ, במסך ההתראות באפליקציה.
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

/**
 * The newsletter teaser email.
 *
 * A newsletter's real design lives at `webUrl` as a full web page (JS, modern
 * CSS, whatever). Email clients render almost none of that, so the email is a
 * deliberately small, table-based, inline-styled card: brand, hero image,
 * subject, one paragraph, and a button to the full page - plus the standard
 * "view in browser" link at the top. No <style>, no <script>.
 */
export function newsletterTeaserEmailHtml(opts: {
  subject: string;
  heroImageUrl: string | null;
  previewText: string;
  webUrl: string;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
  const { subject, heroImageUrl, previewText, webUrl } = opts;
  const url = esc(webUrl);
  const LOGO = 'https://coupons.itaykarkason.com/newsletter-logo.png';
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;background:#eeece5;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td align="center" style="padding:10px 20px;font-size:12px;color:#98a2b3;background:#ffffff">
        <a href="${url}" style="color:#98a2b3">לא רואים את המייל כמו שצריך? צפייה בדפדפן</a>
      </td></tr>
      <tr><td align="right" style="background:#15202e;padding:16px 24px">
        <img src="${LOGO}" alt="קופון מאסטר" width="150" style="display:block;width:150px;max-width:60%;height:auto">
      </td></tr>
      ${heroImageUrl ? `<tr><td><img src="${esc(heroImageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto"></td></tr>` : ''}
      <tr><td style="padding:24px 28px 8px"><h1 style="margin:0;font-size:23px;color:#101828;line-height:1.35">${esc(subject)}</h1></td></tr>
      <tr><td style="padding:0 28px 20px;font-size:15px;line-height:1.7;color:#475467">${esc(previewText)}</td></tr>
      <tr><td align="center" style="padding:8px 28px 34px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1f6fd1;border-radius:12px">
          <a href="${url}" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">לצפייה המלאה</a>
        </td></tr></table>
      </td></tr>
      <tr><td align="center" style="padding:0 28px 26px;font-size:12px;color:#98a2b3">קופון מאסטר · הארנק החכם לקופונים ושוברים</td></tr>
    </table>
  </td></tr></table>
</div>`;
}
