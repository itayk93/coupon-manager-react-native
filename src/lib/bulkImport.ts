import { DecryptedCoupon } from '@/hooks/useCoupons';

export type ImportRow = Partial<DecryptedCoupon> & { __errors?: string[] };

// Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (ch === '\r') {
      // ignore, handled by \n
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Map common Hebrew/English header names to coupon fields.
const HEADER_MAP: Record<string, keyof DecryptedCoupon> = {
  'קוד קופון': 'code',
  'קוד': 'code',
  code: 'code',
  'חברה': 'company',
  company: 'company',
  'ערך מקורי': 'value',
  'ערך': 'value',
  value: 'value',
  'עלות': 'cost',
  cost: 'cost',
  'ערך שהשתמשת בו': 'used_value',
  'ערך נוצל': 'used_value',
  'סטטוס': 'status',
  status: 'status',
  'תאריך תפוגה': 'expiration',
  expiration: 'expiration',
  'תיאור': 'description',
  description: 'description',
  cvv: 'cvv',
  'תוקף כרטיס': 'card_exp',
};

function parseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // Accept dd/mm/yyyy (he-IL) or ISO
  const heMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (heMatch) {
    const [, d, m, y] = heMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(v);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

export function parseCouponsCsv(text: string): ImportRow[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];

  const headers = table[0].map((h) => h.trim());
  const fieldForCol = headers.map((h) => HEADER_MAP[h] || HEADER_MAP[h.toLowerCase()] || null);

  return table.slice(1).map((cols) => {
    const rowObj: ImportRow = { __errors: [] };
    fieldForCol.forEach((field, idx) => {
      if (!field) return;
      const raw = (cols[idx] ?? '').trim();
      if (raw === '') return;
      switch (field) {
        case 'value':
        case 'cost':
        case 'used_value': {
          const num = parseFloat(raw.replace(/[^\d.-]/g, ''));
          (rowObj as any)[field] = isNaN(num) ? 0 : num;
          break;
        }
        case 'expiration':
          rowObj.expiration = parseDate(raw);
          break;
        default:
          (rowObj as any)[field] = raw;
      }
    });

    // Validation
    if (!rowObj.company) rowObj.__errors!.push('חסרה חברה');
    if (rowObj.value === undefined) rowObj.__errors!.push('חסר ערך');
    if (!rowObj.code) rowObj.code = '';
    if (rowObj.cost === undefined) rowObj.cost = rowObj.value ?? 0;
    if (rowObj.used_value === undefined) rowObj.used_value = 0;
    if (!rowObj.status) rowObj.status = 'פעיל';

    return rowObj;
  });
}

export function rowIsValid(row: ImportRow): boolean {
  return !row.__errors || row.__errors.length === 0;
}
