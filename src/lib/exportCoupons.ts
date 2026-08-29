import { jsPDF } from 'jspdf';
import { DecryptedCoupon } from '@/hooks/useCoupons';

const formatDate = (value: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('he-IL');
};

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const legacyExportRows = (coupons: DecryptedCoupon[]) => {
  return coupons.map((coupon) => ({
    'קוד קופון': coupon.code,
    חברה: coupon.company,
    'ערך מקורי': coupon.value,
    עלות: coupon.cost,
    'ערך שהשתמשת בו': coupon.used_value,
    'ערך נותר': coupon.value - coupon.used_value,
    סטטוס: coupon.status,
    'תאריך תפוגה': formatDate(coupon.expiration),
    'תאריך הוספה': formatDateTime(coupon.date_added),
    תיאור: coupon.description || '',
  }));
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportCouponsToExcel = (coupons: DecryptedCoupon[]) => {
  const rows = legacyExportRows(coupons);
  const headers = Object.keys(rows[0] || {});
  const escapeCell = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `
    <html dir="rtl">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table>
          <thead><tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeCell(row[header as keyof typeof row])}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  downloadBlob(
    new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
    'coupons.xls'
  );
};

export const exportCouponsToCSV = (coupons: DecryptedCoupon[]) => {
  const rows = legacyExportRows(coupons);
  const headers = Object.keys(rows[0] || {});
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];

  downloadBlob(
    new Blob(['\uFEFF', csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' }),
    `coupons_export_${new Date().toISOString().split('T')[0]}.csv`
  );
};

export const exportCouponsToPDF = (coupons: DecryptedCoupon[]) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 48;

  doc.setFontSize(16);
  doc.text('קופון מאסטר - coupons export', pageWidth - 40, y, { align: 'right' });
  y += 30;
  doc.setFontSize(10);

  coupons.forEach((coupon) => {
    const remaining = (coupon.value - coupon.used_value).toFixed(2);
    const line = `Code: ${coupon.code} | Company: ${coupon.company} | Remaining: ${remaining} ILS`;
    doc.text(line, pageWidth - 40, y, { align: 'right', maxWidth: pageWidth - 80 });
    y += 20;

    if (y > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  });

  doc.save('coupons.pdf');
};
