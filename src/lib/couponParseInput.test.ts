import { describe, expect, it } from 'vitest';
import { combineCouponInput } from '../../supabase/functions/parse-coupon/input';
import { extractSharedPageUrl, extractVoucherCode } from './couponTextFields';

const message = `שביט מברכת אותך בשנה טובה וחג שמח!
קיבלת שובר All-InZone בשווי 525 ₪
הקוד שלך:
158898090-1533
השובר כולל כפל מבצעים והנחות, לא כולל מבצעי מועדון
לא ניתן למימוש בחנויות עודפים
ניתן למימוש אונליין בכפוף למצויין תחת בית העסק בקישור המצורף מטה
במסעדות מיועד לישיבה בלבד ובהזמנת מקום מראש, לא תקף בעסקיות
באתרי ספא יש לתאם מראש עם בית העסק לפני ההגעה
לרשימת הרשתות ובירור יתרה https://www.htzone.co.il/voucher-zone/10
תוקף השובר: 5 שנים`;

describe('coupon message with a linked page', () => {
  it('preserves All-InZone voucher details when the link contains only a store list', () => {
    const url = extractSharedPageUrl(message);
    expect(url).toBe('https://www.htzone.co.il/voucher-zone/10');
    const input = combineCouponInput(message, url!, 'רשימת רשתות ובירור יתרה. כל הזכויות שמורות');
    expect(input).toContain(message);
    expect(extractVoucherCode(input)).toBe('158898090-1533');
    expect(input).toContain('All-InZone בשווי 525 ₪');
    expect(input).toContain('תוקף השובר: 5 שנים');
    expect(input).toContain('רשימת רשתות ובירור יתרה. כל הזכויות שמורות');
  });

  it('still supplies coupon page details for a bare URL share', () => {
    const url = 'https://example.com/voucher';
    const page = 'שובר בשווי 100 ₪ קוד: 123456789-1234';
    expect(combineCouponInput(url, url, page)).toContain(page);
    expect(combineCouponInput('', url, page)).toContain(page);
  });

  it('preserves the message even if the page is empty', () => {
    expect(combineCouponInput(message, 'https://example.com', '')).toContain(message);
  });
});
