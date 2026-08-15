import { useCouponUsageHistory } from '@/hooks/useCouponUsage';
import { useActiveViewers } from '@/hooks/useActiveViewers';
import { Eye, History } from 'lucide-react';

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export function CouponDetailExtras({ couponId }: { couponId: number }) {
  const { data: history } = useCouponUsageHistory(couponId);
  const { otherViewers } = useActiveViewers(couponId);

  return (
    <div className="mt-4 space-y-4">
      {otherViewers.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-primary">
          <Eye className="h-4 w-4" />
          <span>
            {otherViewers.length === 1 ? 'משתמש נוסף צופה' : `${otherViewers.length} משתמשים נוספים צופים`} בקופון עכשיו
            {otherViewers[0]?.first_name ? ` (${otherViewers.map((v) => v.first_name).filter(Boolean).join(', ')})` : ''}
          </span>
        </div>
      )}

      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold mb-2">
          <History className="h-4 w-4" /> היסטוריית שימוש
        </h4>
        {!history?.length ? (
          <p className="text-sm text-muted-foreground">אין רישומי שימוש עדיין.</p>
        ) : (
          <ul className="space-y-1.5 max-h-40 overflow-y-auto pe-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0">
                <span className="text-muted-foreground">{new Date(h.timestamp).toLocaleString('he-IL')}</span>
                <span className="font-medium">{formatIls(h.used_amount)}{h.details ? ` · ${h.details}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
